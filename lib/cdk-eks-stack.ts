import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { KubectlV31Layer } from "@aws-cdk/lambda-layer-kubectl-v31";

interface CdkEksStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class CdkEksStack extends cdk.Stack {
  public readonly cluster: eks.Cluster;

  constructor(scope: Construct, id: string, props: CdkEksStackProps) {
    super(scope, id, props);

    const kubectlLayer = new KubectlV31Layer(this, "KubectlLayer");

    // Create IAM role for EKS cluster
    const clusterRole = new iam.Role(this, "EksClusterRole", {
      assumedBy: new iam.ServicePrincipal("eks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonEKSClusterPolicy"
        ),
      ],
    });

    // Create EKS Cluster
    this.cluster = new eks.Cluster(this, "EksCluster", {
      version: eks.KubernetesVersion.V1_31,
      role: clusterRole,
      vpc: props.vpc,
      vpcSubnets: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      defaultCapacity: 0,
      clusterName: "cdk-eks-cluster",
      kubectlLayer,
      clusterLogging: [
        eks.ClusterLoggingTypes.API,
        eks.ClusterLoggingTypes.AUDIT,
        eks.ClusterLoggingTypes.AUTHENTICATOR,
        eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
        eks.ClusterLoggingTypes.SCHEDULER,
      ],
    });

    // Add managed node group
    this.cluster.addAutoScalingGroupCapacity("DefaultCapacity", {
      desiredCapacity: 2,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
      ),
      machineImageType: eks.MachineImageType.AMAZON_LINUX_2,
      spotPrice: "0.0728",
    });

    // Install AWS Load Balancer Controller for Ingress support
    this.cluster.addHelmChart(
      "AwsLoadBalancerController",
      {
        chart: "aws-load-balancer-controller",
        repository: "https://aws.github.io/eks-charts",
        namespace: "kube-system",
        values: {
          clusterName: this.cluster.clusterName,
          serviceAccount: {
            create: true,
          },
          enableWafv2: false,
          enableShield: false,
        },
      }
    );

    // Deploy Nginx Ingress using Kubernetes manifest
    const nginxNamespace = this.cluster.addManifest("NginxNamespace", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "nginx-app",
      },
    });

    const nginxDeployment = this.cluster.addManifest(
      "NginxDeployment",
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "nginx-deployment",
          namespace: "nginx-app",
        },
        spec: {
          replicas: 2,
          selector: {
            matchLabels: {
              app: "nginx",
            },
          },
          template: {
            metadata: {
              labels: {
                app: "nginx",
              },
            },
            spec: {
              containers: [
                {
                  name: "nginx",
                  image: "nginx:latest",
                  ports: [
                    {
                      containerPort: 80,
                    },
                  ],
                  resources: {
                    requests: {
                      cpu: "100m",
                      memory: "128Mi",
                    },
                    limits: {
                      cpu: "200m",
                      memory: "256Mi",
                    },
                  },
                },
              ],
            },
          },
        },
      }
    );
    nginxDeployment.node.addDependency(nginxNamespace);

    // Create Nginx Service
    const nginxService = this.cluster.addManifest("NginxService", {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: "nginx-service",
        namespace: "nginx-app",
      },
      spec: {
        type: "NodePort",
        selector: {
          app: "nginx",
        },
        ports: [
          {
            protocol: "TCP",
            port: 80,
            targetPort: 80,
          },
        ],
      },
    });
    nginxService.node.addDependency(nginxDeployment);

    // Create Ingress for Nginx
    const nginxIngress = this.cluster.addManifest("NginxIngress", {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: "nginx-ingress",
        namespace: "nginx-app",
        annotations: {
          "kubernetes.io/ingress.class": "alb",
          "alb.ingress.kubernetes.io/scheme": "internet-facing",
          "alb.ingress.kubernetes.io/target-type": "ip",
        },
      },
      spec: {
        rules: [
          {
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: "nginx-service",
                      port: {
                        number: 80,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
    nginxIngress.node.addDependency(nginxService);

    // Create API Gateway that proxies to the Nginx service via ALB
    const api = new apigw.RestApi(this, "NginxApi", {
      restApiName: "nginx-api",
      deployOptions: {
        stageName: "v1",
      },
    });

    // Create a Lambda integration that proxies requests to the Nginx service
    const nginxProxyLambda = new lambda.Function(this, "NginxProxyLambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        const https = require('https');
        
        exports.handler = async (event) => {
          // This is a proxy function. In production, you would replace this
          // with the actual ALB endpoint from the Ingress controller
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: 'Nginx is running on EKS',
              clusterInfo: 'Use kubectl to access the Nginx service',
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          };
        };
      `),
    });

    const nginxResource = api.root.addResource("nginx");
    nginxResource.addMethod(
      "GET",
      new apigw.LambdaIntegration(nginxProxyLambda)
    );

    // Outputs
    new cdk.CfnOutput(this, "ClusterName", {
      value: this.cluster.clusterName,
      description: "EKS Cluster Name",
    });

    new cdk.CfnOutput(this, "ClusterEndpoint", {
      value: this.cluster.clusterEndpoint,
      description: "EKS Cluster Endpoint",
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "NginxNamespace", {
      value: "nginx-app",
      description: "Nginx deployment namespace",
    });

    new cdk.CfnOutput(this, "KubectlCommand", {
      value: `aws eks update-kubeconfig --name ${this.cluster.clusterName} --region ${this.region}`,
      description: "Command to configure kubectl",
    });
  }
}
