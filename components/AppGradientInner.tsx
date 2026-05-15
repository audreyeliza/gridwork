"use client";

import { ShaderGradient, ShaderGradientCanvas } from "shadergradient";

export default function AppGradientInner() {
  return (
    <ShaderGradientCanvas style={{ position: "absolute", inset: 0 }}>
      <ShaderGradient
        type="waterPlane"
        animate="on"
        uSpeed={0.04}
        uStrength={1.1}
        uDensity={1.3}
        uFrequency={3.5}
        uAmplitude={0}
        color1="#F9A87A"
        color2="#F0569A"
        color3="#9B6FD4"
        positionX={0}
        positionY={0}
        positionZ={0}
        rotationX={50}
        rotationY={0}
        rotationZ={-45}
        reflection={0.05}
        wireframe={false}
        grain="off"
        shader="defaults"
      />
    </ShaderGradientCanvas>
  );
}
