#!/bin/bash
# Hermes Agent Installation Script
# This script safely installs Hermes AI Agent from Nous Research

set -e  # Exit if any command fails

echo "================================"
echo "🤖 Installing Hermes AI Agent"
echo "================================"
echo ""

# Check if curl is installed
if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl is not installed"
    echo "Please install curl first: brew install curl (macOS) or apt-get install curl (Linux)"
    exit 1
fi

# Download and install Hermes Agent
echo "📥 Downloading Hermes Agent installer..."
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

echo ""
echo "✅ Hermes Agent installed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify installation: hermes --version"
echo "2. Initialize a project: hermes init"
echo "3. Read docs: https://hermes-agent.nousresearch.com/docs"
echo ""
