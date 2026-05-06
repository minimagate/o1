import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};

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
          background:
            "linear-gradient(135deg, #111111 0%, #1f1f1f 45%, #d4a017 100%)",
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.06em",
          borderRadius: 8,
        }}
      >
        o1
      </div>
    ),
    {
      ...size,
    },
  );
}
