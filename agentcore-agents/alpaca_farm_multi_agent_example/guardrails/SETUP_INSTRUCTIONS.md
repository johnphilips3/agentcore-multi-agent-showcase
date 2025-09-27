# Bedrock Guardrails Setup Instructions

## Step 1: Create a Guardrail in AWS Bedrock Console

1. **Open AWS Bedrock Console**:
   - Go to https://console.aws.amazon.com/bedrock/
   - Make sure you're in the correct region (us-west-2)

2. **Navigate to Guardrails**:
   - In the left sidebar, click on "Guardrails"
   - Click "Create guardrail"

3. **Configure Your Guardrail**:
   - **Name**: `alpaca-farm-guardrail`
   - **Description**: `Guardrail for alpaca farm management system`
   
4. **Configure Content Filters** (recommended settings):
   - **Hate**: MEDIUM
   - **Insults**: MEDIUM  
   - **Sexual**: HIGH
   - **Violence**: MEDIUM
   - **Misconduct**: MEDIUM
   - **Prompt attacks**: HIGH

5. **Configure Topic Filters** (optional):
   - Add topics you want to block or allow
   - For alpaca farm: you might want to allow agricultural topics

6. **Configure Word Filters** (optional):
   - Add specific words or phrases to block

7. **Configure Sensitive Information Filters** (optional):
   - Enable PII detection if needed

8. **Create the Guardrail**:
   - Click "Create guardrail"
   - Note the **Guardrail ID** (it will look like: `abc123def456`)
   - Note the **Version** (usually starts with `DRAFT`)

## Step 2: Update Environment Variables

After creating the guardrail, update your environment variables:

```bash
export BEDROCK_GUARDRAIL_ID="your-actual-guardrail-id-here"
export BEDROCK_GUARDRAIL_VERSION="DRAFT"
export AWS_REGION="us-west-2"
```

## Step 3: Test the Setup

Run the test script to verify everything works:

```bash
python test_guardrails.py
```

## Common Issues and Solutions

### Issue: "Guardrail was enabled but input is in incorrect format"
- **Cause**: Invalid guardrail ID or version
- **Solution**: Verify the guardrail ID exists in AWS console and use correct version

### Issue: "AccessDeniedException"
- **Cause**: Missing IAM permissions
- **Solution**: Ensure your AWS credentials have `bedrock:ApplyGuardrail` permission

### Issue: "ResourceNotFoundException"
- **Cause**: Guardrail doesn't exist or wrong region
- **Solution**: Verify guardrail exists in the correct AWS region

## Required IAM Permissions

Your AWS credentials need these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:ApplyGuardrail",
                "bedrock:GetGuardrail",
                "bedrock:ListGuardrails"
            ],
            "Resource": "*"
        }
    ]
}
```