// Frame-rate-independent smoothing.
//
// The camera lerps, chassis tilt and upright correction were written as
// `value += (target - value) * k` with a constant `k` implicitly tuned for
// 60 fps. On a 144 Hz display that runs ~2.4× more often, making the camera
// noticeably stiffer (and on a 30 Hz frame it goes mushy). `smoothAlpha`
// converts the old per-frame alpha into the equivalent alpha for the actual
// frame time, so the feel is identical regardless of refresh rate. At exactly
// 60 fps it returns the original constant, so tuning is preserved.
export const smoothAlpha = (perFrameAt60: number, dt: number) =>
  1 - Math.pow(1 - perFrameAt60, dt * 60);
