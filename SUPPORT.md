# Support

## Getting Help

### Documentation

- [README](README.md) - Quick start and overview
- [CLI Reference](docs/cli.md) - Command-line usage
- [FAQ](docs/faq.md) - Common questions
- [Architecture](docs/design.md) - How it works

### Community

- **GitHub Discussions**: [Ask questions](https://github.com/akz4ol/agentlint/discussions)
- **GitHub Issues**: [Report bugs](https://github.com/akz4ol/agentlint/issues)

### Quick Links

| Need | Where |
|------|-------|
| Bug report | [Open an issue](https://github.com/akz4ol/agentlint/issues/new?template=bug_report.yml) |
| Feature request | [Open an issue](https://github.com/akz4ol/agentlint/issues/new?template=feature_request.yml) |
| New rule idea | [Open an issue](https://github.com/akz4ol/agentlint/issues/new?template=new_rule.yml) |
| Security issue | See [SECURITY.md](SECURITY.md) |
| Contributing | See [CONTRIBUTING.md](CONTRIBUTING.md) |

## Self-Help

### Common Issues

**"No files found to scan"**
```bash
# Check your include patterns
agentlint scan --verbose
```

**"Parse errors"**
```bash
# AgentLint continues with partial results
# Check output for warnings
```

**"CI failing unexpectedly"**
```bash
# Lower the threshold temporarily
agentlint scan --fail-on high
```

### Debug Mode

```bash
# Verbose output
agentlint scan --verbose

# JSON output for debugging
agentlint scan --format json | jq '.documents'
```

## Response Times

- **Bug reports**: Triaged within 1 week
- **Feature requests**: Reviewed monthly
- **Security issues**: See [SECURITY.md](SECURITY.md)

## Commercial Support

No commercial support is currently offered. For enterprise needs, open a GitHub Discussion.
