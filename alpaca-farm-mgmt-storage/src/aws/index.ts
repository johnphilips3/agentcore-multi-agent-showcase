// AWS Configuration Management
export {
  AWSConfig,
  AWSServiceClients,
  AWSConfigurationError,
  AWSConfigManager,
  ValidationResult,
  ConnectionTestResult,
  S3LifecycleRule,
  getAWSConfigManager,
  resetAWSConfigManager,
  createAWSConfigFromEnvironment
} from './config';

// AWS Utilities
export {
  AWSHealthCheck,
  AWSResourceInfo,
  RDSInstanceInfo,
  S3BucketInfo,
  CloudWatchLogGroupInfo,
  AWSUtilities,
  createAWSUtilities,
  quickHealthCheck,
  validateAWSEnvironment
} from './utils';

// AWS RDS Management
export {
  RDSConnectionConfig,
  RDSInstanceInfo as RDSDetailedInstanceInfo,
  RDSHealthStatus,
  RDSConnectionError,
  RDSManager,
  createRDSManager,
  getRDSManager,
  resetRDSManager
} from './rds';

// AWS S3 Backup Management
export {
  S3BackupConfig,
  S3LifecycleRule as S3DetailedLifecycleRule,
  BackupMetadata,
  S3BackupInfo,
  S3UploadProgress,
  S3BackupError,
  S3BackupManager,
  createS3BackupManager,
  getS3BackupManager,
  resetS3BackupManager
} from './s3';

// Re-export commonly used AWS SDK types
export { RDS, S3, CloudWatch } from 'aws-sdk';