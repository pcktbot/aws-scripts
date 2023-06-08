const AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});

const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const cloudfront = new AWS.CloudFront();
const lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

const bucketParams = {
  Bucket : "your-bucket-name", 
  ACL : "public-read"
};

s3.createBucket(bucketParams, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Bucket URL is ", data.Location);
    
    // put an object to the bucket
    let uploadParams = {Bucket: 'your-bucket-name', Key: '', Body: ''};
    let file = 'your-file-path';

    let fs = require('fs');
    let fileStream = fs.createReadStream(file);
    fileStream.on('error', function(err) {
      console.log('File Error', err);
    });
    uploadParams.Body = fileStream;
    uploadParams.Key = path.basename(file);

    s3.upload (uploadParams, function (err, data) {
      if (err) {
        console.log("Error", err);
      } if (data) {
        console.log("Upload Success", data.Location);
      }
    });

    // Create a CloudFront distribution
    const cfParams = {
      DistributionConfig: {
        CallerReference: 'your-caller-reference', 
        Comment: 'your-comment', 
        DefaultCacheBehavior: { 
          ForwardedValues: {
            Cookies: { Forward: 'none' },
            QueryString: false
          },
          MinTTL: 0,
          TargetOriginId: 'your-target-origin-id',
          TrustedSigners: { Enabled: false, Quantity: 0 },
          ViewerProtocolPolicy: 'allow-all'
        },
        Enabled: true,
        Origins: { Quantity: 1,
          Items: [
            {
              DomainName: 'your-bucket-name.s3.amazonaws.com',
              Id: 'your-target-origin-id',
              S3OriginConfig: { OriginAccessIdentity: '' }
            }
          ]
        }
      }
    };

    cloudfront.createDistribution(cfParams, function(err, data) {
      if (err) console.log(err, err.stack);
      else     console.log(data);
    });

    // Create a Lambda function and associate it with the distribution
    const lambdaParams = {
      Code: {
        S3Bucket: 'your-bucket-name',
        S3Key: 'your-zip-file-name'
      },
      FunctionName: 'LambdaEdgeFunction',
      Handler: 'index.handler',
      Role: 'your-execution-role-arn',
      Runtime: 'nodejs14.x',
      Publish: true
    };

    lambda.createFunction(lambdaParams, function(err, data) {
      if (err) console.log(err, err.stack);
      else     console.log(data);
      
      const lambdaArn = data.FunctionArn;

      // Associate Lambda function with CloudFront
      // Assuming the distribution was successfully created and its Id is 'your-distribution-id'
      const lambdaAtEdgeParams = {
        DistributionId: 'your-distribution-id',
        LambdaFunctionAssociations: {
          Quantity: 1,
          Items: [{
            EventType: 'viewer-request',
            LambdaFunctionARN: lambdaArn
          }]
        }
      };
      cloudfront.createDistributionWithTags(lambdaAtEdgeParams, function(err, data) {
        if (err) console.log(err, err.stack);
        else     console.log(data);
      });
    });
  }
});
