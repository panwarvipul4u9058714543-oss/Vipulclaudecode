# 🤖 Hermes AI Agent Setup Guide

## What is Hermes?

**Hermes** is an AI agent framework from Nous Research that lets you:
- ✅ Create autonomous AI agents
- ✅ Automate tasks and workflows
- ✅ Build intelligent chatbots
- ✅ Deploy agents to the cloud

Think of it like creating a **smart robot** that can think and make decisions on its own.

---

## 📋 Step-by-Step Installation

### **Step 1: Prerequisites Check**

Before installing Hermes, make sure you have:
- ✅ **Bash or Shell** (on macOS/Linux) or **PowerShell** (on Windows)
- ✅ **curl** (to download files)
- ✅ **Internet connection**

To check if curl is installed:
```bash
curl --version
```

If not installed:
- **macOS:** `brew install curl`
- **Linux:** `sudo apt-get install curl`
- **Windows:** Use PowerShell or install Git Bash

---

### **Step 2: Download & Install Hermes Agent**

Run this command in your terminal:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

**What this does:**
- 📥 Downloads the Hermes installation file
- ⚙️ Runs the installer automatically
- 📦 Installs Hermes and its dependencies

This will take **2-5 minutes**.

---

### **Step 3: Verify Installation**

Check if Hermes installed correctly:

```bash
hermes --version
```

**Expected output:** You should see a version number like `hermes 1.0.0`

---

### **Step 4: Initialize Your First Agent**

Create a new Hermes agent project:

```bash
hermes init my-first-agent
```

This creates a folder with your agent setup.

---

### **Step 5: Navigate to Your Agent**

```bash
cd my-first-agent
```

---

### **Step 6: Start Your Agent**

```bash
hermes run
```

Your agent is now **running**! 🎉

---

## 🎯 What to Do Next

### **A. Customize Your Agent**

Edit the agent configuration:
```bash
# Open the agent config (usually agent.yaml or config.json)
code .
```

### **B. Add Tools & Capabilities**

Hermes lets you give your agent special powers:
- 🔍 Web search
- 📧 Email sending
- 💾 Database access
- 🌐 API calls

Check the docs: https://hermes-agent.nousresearch.com/docs

### **C. Test Your Agent**

```bash
# In the agent directory
hermes test
```

### **D. Deploy Your Agent**

```bash
# Deploy to cloud
hermes deploy
```

---

## 📁 Project Structure

After setup, your repository will look like:

```
Vipulclaudecode/
├── scripts/
│   └── install-hermes.sh          # Installation script
├── my-first-agent/                # Your agent project
│   ├── agent.yaml                 # Agent configuration
│   ├── main.py                    # Agent logic (Python)
│   └── README.md                  # Agent documentation
├── CLAUDE.md                      # AI coding guidelines
├── README.md                      # Project README
└── .claude/memory/                # Session memory files
```

---

## 🐛 Troubleshooting

### **Problem: "hermes command not found"**

**Solution:**
```bash
# Add Hermes to PATH
export PATH="$HOME/.hermes/bin:$PATH"

# Or reinstall
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

### **Problem: "Permission denied" when running script**

**Solution:**
```bash
chmod +x scripts/install-hermes.sh
bash scripts/install-hermes.sh
```

### **Problem: Curl download fails**

**Solution:**
```bash
# Try with verbose output to see what's wrong
curl -v https://hermes-agent.nousresearch.com/install.sh

# Check your internet connection
ping google.com
```

---

## 🚀 Quick Command Reference

```bash
# Check Hermes version
hermes --version

# Create new agent
hermes init [agent-name]

# Run agent
hermes run

# Test agent
hermes test

# Deploy agent
hermes deploy

# Get help
hermes --help
```

---

## 📚 Resources

- **Official Docs:** https://hermes-agent.nousresearch.com/docs
- **GitHub:** https://github.com/nousresearch/hermes
- **Community:** https://discord.gg/nousresearch
- **Examples:** https://hermes-agent.nousresearch.com/examples

---

## ✅ You're All Set!

Your Hermes Agent is now:
- ✅ Installed in your system
- ✅ Ready to create agents
- ✅ Documented and configured
- ✅ Ready to deploy

**Next Steps:**
1. Run `hermes init my-agent`
2. Customize your agent
3. Test it locally
4. Deploy it!

Happy building! 🚀
