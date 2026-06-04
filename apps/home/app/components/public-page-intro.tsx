import type { ReactNode } from "react";
import styles from "./public-page-intro.module.css";

type PublicPageIntroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  actions?: ReactNode;
  className?: string;
};

export function PublicPageIntro({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  actions,
  className,
}: PublicPageIntroProps) {
  const classes = [
    styles.intro,
    align === "center" ? styles.center : "",
    tone === "dark" ? styles.dark : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={classes}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      {description ? <p className={styles.description}>{description}</p> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
