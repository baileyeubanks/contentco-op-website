"use client";

import React from "react";

type MetaItem = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warn" | "success";
};

type ActionItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "primary" | "secondary" | "warn";
};

type ScopeValue = "ALL" | "ACS" | "CC";

interface ModuleHeaderProps {
  kicker: string;
  title: string;
  description: string;
  meta?: MetaItem[];
  scope?: {
    value: ScopeValue;
    onChange: (value: ScopeValue) => void;
    options?: ScopeValue[];
  };
  actions?: ActionItem[];
}

export function ModuleHeader({
  kicker,
  title,
  description,
  meta = [],
  scope,
  actions = [],
}: ModuleHeaderProps) {
  return (
    <div className="root-module-header">
      <div className="root-module-header__copy">
        <div className="root-atlas-kicker">{kicker}</div>
        <h1 className="root-atlas-title">{title}</h1>
        <p className="root-atlas-copy">{description}</p>
        {meta.length > 0 ? (
          <div className="root-module-header__meta">
            {meta.map((item) => (
              <span
                key={`${item.label}:${item.value}`}
                className={`root-module-chip${item.tone ? ` root-module-chip--${item.tone}` : ""}`}
              >
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {(scope || actions.length > 0) ? (
        <div className="root-module-header__controls">
          {scope ? (
            <div className="root-atlas-context-toggle">
              {(scope.options || ["ALL", "ACS", "CC"]).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => scope.onChange(entry)}
                  className={scope.value === entry ? "active" : undefined}
                >
                  {entry.toLowerCase()}
                </button>
              ))}
            </div>
          ) : null}

          {actions.length > 0 ? (
            <div className="root-module-header__actions">
              {actions.map((action) => {
                const className = `root-atlas-button root-atlas-button-${action.tone || "secondary"}`;
                if (action.href) {
                  return (
                    <a key={action.label} href={action.href} className={className}>
                      {action.label}
                    </a>
                  );
                }

                return (
                  <button key={action.label} type="button" onClick={action.onClick} className={className}>
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
