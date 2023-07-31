import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { readFileSync } from 'fs';
import * as rds from 'aws-cdk-lib/aws-rds';

export class CdkTutorialStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // VPCの作成
    const vpc = new ec2.Vpc(this, 'BlogVPC', {
      // ipV4 CIDR
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      // natGateways はコスト/h がかかるので、0にしてプライベートサブネットからはインターネットアクセスをしないようにする
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    })

    const webServer1 = new ec2.Instance(this, 'WebServer1', {
      // ec2 インスタンスを起動する VPC を指定
      vpc,
      // インスタンスタイプ
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      // OS イメージ
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
    })

    // WORDPRESSのインストール
    const script = readFileSync("./lib/resouces/user-data.sh", "utf8")
    webServer1.addUserData(script)

    webServer1.connections.allowFromAnyIpv4(ec2.Port.tcp(80))

    // EC2 インスタンスアクセス用の IP アドレスを出力
    new CfnOutput(this, "WordpressServer1PublicIPAddress", {
      value: `http://${webServer1.instancePublicIp}`,
    });

    // RDS インスタンスの作成

    const rdsInstance = new rds.DatabaseInstance(this, 'WordpressDatabase', {
      vpc,
      // インスタンスタイプ
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_33
      }),
      databaseName: 'wordpress',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      }
    })
    // WebServer からのアクセスを許可
    rdsInstance.connections.allowDefaultPortFrom(webServer1)
  }
}
