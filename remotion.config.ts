import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 竖屏 1080x1920，H.264 / MP4
Config.setCodec("h264");
