import os
import subprocess
import json
import hashlib

# 从 videos.json 读取 m3u8 链接
with open("videos.json", "r", encoding="utf-8") as f:
    data = json.load(f)
video_urls = data.get("m3u8", [])

# 下载函数
def is_file_complete(filepath):
    # 检查文件是否存在且大于 1MB，粗略判断完整性
    return os.path.exists(filepath) and os.path.getsize(filepath) > 1024 * 1024

def download_video(url, index):
    output_dir = "videos"
    os.makedirs(output_dir, exist_ok=True)
    url_md5 = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
    output_filename = os.path.join(output_dir, f"{url_md5}.mp4")
    tmp_filename = os.path.join(output_dir, f"{url_md5}_tmp.mp4")
    if is_file_complete(output_filename):
        print(f"⏩ 已存在且完整，跳过: {output_filename}")
        return
    cmd = [
        "ffmpeg",
        "-y",  # 自动覆盖已有文件
        "-i", url,
        "-c", "copy",
        tmp_filename
    ]
    print(f"⏬ 正在下载: {tmp_filename}")
    subprocess.run(cmd)
    # 下载完成后判断完整性再重命名
    if is_file_complete(tmp_filename):
        os.rename(tmp_filename, output_filename)
        print(f"✅ 下载完成: {output_filename}\n")
    else:
        if os.path.exists(tmp_filename):
            os.remove(tmp_filename)
        print(f"❌ 下载失败或不完整: {output_filename}\n")

# 批量执行
for idx, url in enumerate(video_urls):
    download_video(url, idx)
