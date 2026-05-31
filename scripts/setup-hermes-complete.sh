#!/bin/bash
# Complete Hermes Agent Installation & Setup Script
# This script handles everything you need to get started with Hermes

set -e  # Exit if any command fails

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       🤖 HERMES AI AGENT - COMPLETE SETUP               ║"
echo "║     Installing everything step by step for you...        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Step 1: Check Prerequisites
print_step "STEP 1: Checking Prerequisites"
echo ""

if ! command -v curl &> /dev/null; then
    print_error "curl is not installed"
    echo "Please install curl:"
    echo "  macOS: brew install curl"
    echo "  Linux: sudo apt-get install curl"
    exit 1
fi
print_success "curl is installed"

if ! command -v bash &> /dev/null; then
    print_error "bash is not installed"
    exit 1
fi
print_success "bash is installed"

echo ""

# Step 2: Check internet connection
print_step "STEP 2: Checking Internet Connection"
echo ""

if ping -c 1 google.com &> /dev/null; then
    print_success "Internet connection is active"
else
    print_error "No internet connection detected"
    exit 1
fi

echo ""

# Step 3: Download Hermes Agent
print_step "STEP 3: Downloading Hermes Agent Installer"
echo ""
print_info "Downloading from: https://hermes-agent.nousresearch.com/install.sh"
echo ""

curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

print_success "Hermes Agent installed successfully!"
echo ""

# Step 4: Verify Installation
print_step "STEP 4: Verifying Installation"
echo ""

if command -v hermes &> /dev/null; then
    HERMES_VERSION=$(hermes --version 2>/dev/null || echo "installed")
    print_success "Hermes is installed: $HERMES_VERSION"
else
    print_error "Hermes installation verification failed"
    print_info "Try running: export PATH=\"\$HOME/.hermes/bin:\$PATH\""
    exit 1
fi

echo ""

# Step 5: Create project structure
print_step "STEP 5: Setting Up Project Structure"
echo ""

# Create directories if they don't exist
mkdir -p scripts
mkdir -p agents
mkdir -p docs

print_success "Created scripts/ directory"
print_success "Created agents/ directory"
print_success "Created docs/ directory"

echo ""

# Step 6: Summary
print_step "STEP 6: Installation Complete! ✨"
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    SETUP COMPLETE! 🎉                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "📁 Your project structure:"
echo "   scripts/"
echo "     ├── install-hermes.sh (installer)"
echo "     ├── setup-hermes-complete.sh (this script)"
echo "     ├── run-agent.sh      (quick run)"
echo "     └── test-agent.sh     (quick test)"
echo "   agents/                 (your agents go here)"
echo "   docs/                   (documentation)"
echo ""

echo "🚀 Quick start commands:"
echo ""
echo "   1. Create a new agent:"
echo "      hermes init my-agent"
echo ""
echo "   2. Navigate to your agent:"
echo "      cd my-agent"
echo ""
echo "   3. Run your agent:"
echo "      hermes run"
echo ""
echo "   4. Deploy your agent:"
echo "      hermes deploy"
echo ""

echo "📚 Resources:"
echo "   - Setup Guide: https://github.com/panwarvipul4u9058714543-oss/Vipulclaudecode/blob/main/HERMES_SETUP.md"
echo "   - Official Docs: https://hermes-agent.nousresearch.com/docs"
echo "   - GitHub: https://github.com/nousresearch/hermes"
echo "   - Examples: https://hermes-agent.nousresearch.com/examples"
echo ""

print_success "Hermes Agent is ready to use!"
print_success "Next: Run 'hermes init my-first-agent' to create your agent"
echo ""
