# Real-Time Media Encoding Invariants

When creating FFmpeg process execution plans for real-time streaming (e.g., WebRTC host pipelines):
1. **Never use default lookahead queues for software video encoders**: Default H.264/VP9 settings buffer multiple frames, preventing immediate stdout delivery.
2. **Apply Zero-Latency Tuning**:
   - For `libx264`: Always include `-tune zerolatency -preset ultrafast`
   - For `libvpx-vp9`: Always include `-tune zerolatency -deadline realtime`
3. **Verify Immediate NAL Output**: Ensure the first IDR/SPS frame flushes on frame 0 to prevent WebRTC track initialization timeouts.
