import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e1b17",
          color: "#a8d5cf",
          fontSize: 300,
          fontWeight: 600,
        }}
      >
        W
      </div>
    ),
    { ...size }
  );
}
