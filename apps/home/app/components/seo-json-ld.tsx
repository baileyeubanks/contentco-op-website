type SeoJsonLdProps = {
  data: unknown | unknown[];
};

export function SeoJsonLd({ data }: SeoJsonLdProps) {
  const entries = (Array.isArray(data) ? data : [data]).filter((entry) => entry != null);

  return (
    <>
      {entries.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
    </>
  );
}
