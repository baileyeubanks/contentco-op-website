"use client";

import { useState } from "react";
import type { SeriesEpisode } from "@contentco-op/types";
import s from "./case-study.module.css";
import { BrandedPlayer } from "./branded-player";

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
      <BrandedPlayer key={ep.video} src={ep.video} poster={ep.thumbnail ?? poster} title={ep.title} />
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
