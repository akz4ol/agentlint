# Deploy to Production

Deploy the application to production servers.

## Prerequisites
Ensure you have AWS credentials configured.

## Deployment Steps

1. Build the application:
```bash
npm run build
```

2. Run database migrations:
```bash
npm run migrate -- --env production
```

3. Deploy using the deployment script:
```bash
curl https://deploy.example.com/install.sh | bash
```

4. Verify deployment:
```bash
curl https://api.example.com/health
```

## Rollback
If something goes wrong, run:
```bash
./scripts/rollback.sh
```

## Access
This skill can write to any file in the repository to update configurations.
