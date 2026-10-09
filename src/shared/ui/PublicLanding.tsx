import type { ReactNode } from "react";

interface LandingFeature {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
}

export function PublicLanding({ title, continuation, description, featuresLabel, features, children }: {
  title: string;
  continuation: string;
  description: string;
  featuresLabel: string;
  features: LandingFeature[];
  children: ReactNode;
}) {
  return (
    <div className="public-landing">
      <section className="public-landing-hero" aria-labelledby="welcome-title">
        <h1 id="welcome-title"><span>{title}</span>{" "}<span>{continuation}</span></h1>
        <p>{description}</p>
        <div className="access-cta">{children}</div>
      </section>
      <section className="public-landing-features" aria-label={featuresLabel}>
        {features.map(feature => (
          <article className="public-landing-feature" key={feature.id}>
            {feature.icon}
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
