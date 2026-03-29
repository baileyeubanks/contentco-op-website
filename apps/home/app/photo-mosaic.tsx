"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

// 139 unique photos — no duplicates
const ALL_PHOTOS: string[] = [
  "/photos/11011942_1590723794475868_2627309221054685433_o.jpg",
  "/photos/11947812_1665332363681677_8399032948176998370_o.jpg",
  "/photos/12080024_1672001846348062_6802916927302760787_o.jpg",
  "/photos/17310037_1905723109642600_2790658601564716078_o.jpg",
  "/photos/2015.01.18_BP%20STEM%20Production_280.jpg",
  "/photos/2015.04.19_BPMS150_CC%20BTS_111.jpg",
  "/photos/2015.04.19_BPMS150_CC%20BTS_115.jpg",
  "/photos/2024-02-04%20%281%29.webp",
  "/photos/2024-02-04.webp",
  "/photos/2024-04-05.webp",
  "/photos/2P1A1501.jpeg",
  "/photos/2P1A1510.jpeg",
  "/photos/2P1A1899.jpeg",
  "/photos/2P1A2027.jpg",
  "/photos/2P1A2446.jpeg",
  "/photos/2P1A2572.jpeg",
  "/photos/2P1A2669.jpeg",
  "/photos/2P1A2791.jpeg",
  "/photos/2P1A2977.jpeg",
  "/photos/2P1A3770.jpeg",
  "/photos/2P1A4068.jpeg",
  "/photos/2P1A4372.jpeg",
  "/photos/2P1A4487.jpeg",
  "/photos/2P1A5239.jpg",
  "/photos/2P1A5284.jpeg",
  "/photos/2P1A5347.jpeg",
  "/photos/2P1A5414.jpeg",
  "/photos/2P1A5459.jpeg",
  "/photos/2P1A5565.jpeg",
  "/photos/2P1A5613.jpeg",
  "/photos/2P1A6081.jpeg",
  "/photos/2P1A6199.jpeg",
  "/photos/2P1A6354.jpeg",
  "/photos/2P1A6377.jpeg",
  "/photos/2P1A6416.jpeg",
  "/photos/2P1A6489.jpeg",
  "/photos/4G9A0385.JPG",
  "/photos/4G9A1137.jpg",
  "/photos/4G9A4069.jpg",
  "/photos/4G9A4726.JPG",
  "/photos/4G9A5274-2.jpg",
  "/photos/4G9A6146.jpg",
  "/photos/CheerBowl_%20%281%20of%205%29.jpg",
  "/photos/CheerBowl_%20%282%20of%205%29.jpg",
  "/photos/Electric%20Forest_01-17.jpg",
  "/photos/Electric%20Forest_01-22.jpg",
  "/photos/HLSR2018%20%2812%20of%2019%29.jpeg",
  "/photos/HLSR2018%20%2817%20of%2019%29.jpeg",
  "/photos/IMG_0289.JPG",
  "/photos/IMG_0297.JPG",
  "/photos/IMG_0307.JPG",
  "/photos/IMG_0320.jpg",
  "/photos/IMG_0375.JPG",
  "/photos/IMG_0432.JPG",
  "/photos/IMG_0433.JPG",
  "/photos/IMG_0434.JPG",
  "/photos/IMG_0435.JPG",
  "/photos/IMG_0436.JPG",
  "/photos/IMG_0438.JPG",
  "/photos/IMG_0652.JPG",
  "/photos/IMG_1049.jpg",
  "/photos/IMG_1066.jpg",
  "/photos/IMG_1076.jpg",
  "/photos/IMG_1295.JPG",
  "/photos/IMG_1324.JPG",
  "/photos/IMG_1327.JPG",
  "/photos/IMG_1335.JPG",
  "/photos/IMG_1339.JPG",
  "/photos/IMG_1347.JPG",
  "/photos/IMG_1348.JPG",
  "/photos/IMG_1353.JPG",
  "/photos/IMG_1381.JPG",
  "/photos/IMG_3256.JPG",
  "/photos/IMG_3257.JPG",
  "/photos/IMG_3258.JPG",
  "/photos/IMG_3259.JPG",
  "/photos/IMG_4463.JPG",
  "/photos/IMG_4834.JPG",
  "/photos/IMG_4979.JPG",
  "/photos/IMG_4980.JPG",
  "/photos/IMG_4983.JPG",
  "/photos/IMG_4986.JPG",
  "/photos/IMG_5071.jpg",
  "/photos/IMG_6731.JPG",
  "/photos/IMG_7035.JPG",
  "/photos/IMG_7037.JPG",
  "/photos/IMG_7109.jpg",
  "/photos/IMG_7110.jpg",
  "/photos/IMG_7123.JPG",
  "/photos/IMG_7163.JPG",
  "/photos/IMG_7169.JPG",
  "/photos/IMG_7170.JPG",
  "/photos/IMG_7178.JPG",
  "/photos/IMG_7184.JPG",
  "/photos/IMG_7382.JPG",
  "/photos/IMG_7384.jpg",
  "/photos/IMG_7399.JPG",
  "/photos/IMG_7709.JPG",
  "/photos/IMG_8156.JPG",
  "/photos/IMG_8171.jpg",
  "/photos/IMG_8172.jpg",
  "/photos/IMG_8175.JPG",
  "/photos/IMG_8176.JPG",
  "/photos/IMG_8178.JPG",
  "/photos/IMG_9426.jpg",
  "/photos/mccraeatdock.jpeg",
  "/photos/P1377469.jpg",
  "/photos/P1377564.jpg",
  "/photos/P1377595.JPG",
  "/photos/P1444812.jpeg",
  "/photos/P1477465.jpeg",
  "/photos/P1488032.jpeg",
  "/photos/P1488092.jpeg",
  "/photos/P1488151.jpeg",
  "/photos/P1488193.jpeg",
  "/photos/P1488319-2.jpeg",
  "/photos/P1488421-2.jpeg",
  "/photos/P1677057.jpeg",
  "/photos/P1688130.jpeg",
  "/photos/P1699463.jpeg",
  "/photos/P1699997.jpeg",
  "/photos/P1700037-2.jpeg",
  "/photos/P1700037.jpeg",
  "/photos/P1700096.jpeg",
  "/photos/P1700905.jpeg",
  "/photos/P1711106.jpeg",
  "/photos/P1722117.jpg",
  "/photos/P1722679.jpg",
  "/photos/P1722765.jpg",
  "/photos/P1722990.jpg",
  "/photos/Photo_6553675_DJI_75_jpg_6641507_0_2021106182022_photo_original.jpg",
  "/photos/STEM%20BTS%20Football-117.JPG",
  "/photos/STEM%20BTS%20Running-116.JPG",
  "/photos/STEM%20Football-100.JPG",
  "/photos/STEM%20Gymnastics-101.jpeg",
  "/photos/STEM%20Gymnastics-102.jpeg",
  "/photos/STEM%20Swimming-100.JPG",
  "/photos/STEM%20Swimming-101.jpeg",
  "/photos/STEM_01-1.jpg",
];

const TILE_COUNT = 80; // how many tiles visible in the grid

function shuffle(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PhotoMosaic() {
  const [grid, setGrid] = useState<string[]>(() => shuffle(ALL_PHOTOS).slice(0, TILE_COUNT));
  const [swapping, setSwapping] = useState<number | null>(null);

  const swapOne = useCallback(() => {
    setGrid((prev) => {
      const next = [...prev];
      const idx = Math.floor(Math.random() * next.length);
      // Pick a photo not already in the grid
      const available = ALL_PHOTOS.filter((p) => !next.includes(p));
      if (available.length === 0) return next;
      const newPhoto = available[Math.floor(Math.random() * available.length)];
      setSwapping(idx);
      next[idx] = newPhoto;
      return next;
    });
    // Clear swap animation flag after transition
    setTimeout(() => setSwapping(null), 900);
  }, []);

  useEffect(() => {
    const tick = () => {
      swapOne();
      timeoutId = window.setTimeout(tick, 5000 + Math.random() * 5000);
    };
    let timeoutId = window.setTimeout(tick, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [swapOne]);

  return (
    <section id="work" className="mosaic-wall" aria-label="Selected work">
      {grid.map((src, i) => (
        <div key={i} className={`mosaic-tile ${swapping === i ? "mosaic-tile-swap" : ""}`}>
          <Image
            src={src}
            alt=""
            width={400}
            height={400}
            className="mosaic-img"
            loading={i < 24 ? "eager" : "lazy"}
            draggable={false}
            quality={75}
            sizes="(max-width: 768px) 25vw, 12vw"
          />
        </div>
      ))}
    </section>
  );
}
