#!/usr/bin/env python3
# 简单的图标生成脚本
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # 创建背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 渐变背景 (简化为单色)
    draw.rounded_rectangle([0, 0, size, size], radius=size//8, fill='#4A90E2')
    
    # 添加图标文字
    font_size = size // 2
    try:
        # 尝试使用系统字体
        font = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', font_size)
    except:
        # 使用默认字体
        font = ImageFont.load_default()
    
    # 绘制闪电符号
    text = '⚡'
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    draw.text((x, y), text, fill='white', font=font)
    
    return img

def main():
    # 创建 icons 目录
    os.makedirs('icons', exist_ok=True)
    
    # 生成不同尺寸的图标
    sizes = [16, 48, 128]
    for size in sizes:
        icon = create_icon(size)
        icon.save(f'icons/icon{size}.png')
        print(f'Created icon{size}.png')

if __name__ == '__main__':
    main()