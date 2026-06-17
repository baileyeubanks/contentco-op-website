"use client";

import { useState } from "react";
import type { SeriesEpisode } from "@contentco-op/types";
import s from "./case-study.module.css";

export function EpisodePlayer({
  episodes,
  poster,
}: {
  episodes: SeriesEpisode[];
  poster?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const ep = episodes[activeIndex];

  return (
    <div>
      <div className={s.videoFrame}>
        <video
          key={ep.video}
          controls
          preload="metadata"
          poster={ep.thumbnail ?? poster}
          src={ep.video}
        />
      </div>
      <div className={s.episodeStrip} role="group" aria-label="Episode selector">
        {episodes.map((e, i) => (
          <button
            key={e.number}
            className={`${s.episodeBtn}${i === activeIndex ? ` ${s.episodeBtnActive}` : ""}`}
            onClick={() => setActiveIndex(i)}
            aria-pressed={i === activeIndex}
          >
            <span className={s.episodeBtnNum}>Ep {e.number}</span>
            {e.title !== `Episode ${e.number}` && (
              <span className={s.episodeBtnTitle}>{e.title}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
