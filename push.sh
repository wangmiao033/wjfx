#!/bin/bash
# FileShare v2.0 推送脚本
# 用法1: 提供GitHub PAT
#   ./push.sh ghp_your_token_here
# 用法2: 已添加SSH key到GitHub
#   ./push.sh

cd /home/z/my-project

if [ -n "$1" ]; then
    echo "使用 HTTPS + Token 推送..."
    git remote set-url origin "https://wangmiao033:$1@github.com/wangmiao033/wjfx.git"
    git push origin main
    # 推送后移除token
    git remote set-url origin "git@github.com:wangmiao033/wjfx.git"
else
    echo "使用 SSH 推送..."
    git push origin main
fi
