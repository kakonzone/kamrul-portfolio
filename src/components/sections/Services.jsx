import Card from '../ui/Card';
import SectionHeading from '../ui/SectionHeading';
import { services } from '../../data/services';

export default function Services() {
  return (
    <section id="services" className="bg-bg px-6 py-24">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading label="Services" title="What I can do for you" />

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:items-start lg:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card key={service.id} className="p-6">
                <Icon size={32} className="text-accent" strokeWidth={1.8} aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold text-fg">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {service.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}