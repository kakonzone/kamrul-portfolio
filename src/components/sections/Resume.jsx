import Button from '../ui/Button';
import Card from '../ui/Card';
import SectionHeading from '../ui/SectionHeading';
import { profile } from '../../data/profile';

export default function Resume() {
  return (
    <section id="resume" className="bg-bg px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          label="Resume"
          title="Want to know more about my background?"
          align="center"
        />

        <Card className="mt-12 p-10 text-center">
          <p className="mx-auto max-w-xl text-base leading-relaxed text-muted">
            Download my resume for a concise overview of my technical skills,
            education, training, and selected projects.
          </p>
          <Button href={profile.resumeUrl} variant="primary" download className="mt-8">
            Download Resume (PDF)
          </Button>
        </Card>
      </div>
    </section>
  );
}