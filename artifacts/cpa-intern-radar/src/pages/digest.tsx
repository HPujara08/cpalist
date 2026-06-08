import { useGetDigest } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ExternalLink, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Digest() {
  const { data: digest, isLoading } = useGetDigest();

  if (isLoading || !digest) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">The Radar Digest</h1>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <CalendarDays className="w-4 h-4" />
          <span className="font-mono text-sm tracking-wider uppercase">
            {format(new Date(digest.date), "EEEE, MMMM do, yyyy")}
          </span>
        </div>
        <p className="mt-4 text-muted-foreground italic">
          Curated intelligence on accounting internship openings from top CPA firms.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold border-b border-border pb-2 mb-6 flex items-center justify-between">
            <span>New Today</span>
            <Badge variant="default" className="text-sm px-2 rounded-full">{digest.newToday.length}</Badge>
          </h2>
          
          {digest.newToday.length === 0 ? (
            <p className="text-muted-foreground italic">No new internships spotted today.</p>
          ) : (
            <div className="space-y-6">
              {digest.newToday.map((job) => (
                <article key={job.id} className="group">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                        {job.applyUrl ? (
                          <a href={job.applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center">
                            {job.title} <ExternalLink className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ) : (
                          job.title
                        )}
                      </h3>
                      <div className="text-sm font-semibold text-primary mt-1">{job.firmName}</div>
                    </div>
                    {job.term && (
                      <Badge variant="outline" className="font-mono uppercase text-xs whitespace-nowrap">{job.term}</Badge>
                    )}
                  </div>
                  {job.location && (
                    <p className="text-sm text-muted-foreground mt-2">{job.location}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold border-b border-border pb-2 mb-6 flex items-center justify-between">
            <span>Still Open</span>
            <span className="text-sm font-normal text-muted-foreground">{digest.totalActive} total active</span>
          </h2>
          
          <div className="space-y-4">
            {digest.stillOpen.slice(0, 20).map((job) => (
              <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm w-32 truncate">{job.firmName}</span>
                  <span className="text-sm">{job.title}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="font-mono hidden sm:inline-block">{format(new Date(job.firstSeen), "MM/dd")}</span>
                  {job.applyUrl && (
                    <a href={job.applyUrl} target="_blank" rel="noreferrer" className="hover:text-primary">Apply</a>
                  )}
                </div>
              </div>
            ))}
            {digest.stillOpen.length > 20 && (
              <div className="text-center py-4 text-sm text-muted-foreground italic">
                And {digest.stillOpen.length - 20} more active positions on the Jobs board.
              </div>
            )}
          </div>
        </section>
      </div>
      
      <footer className="mt-24 pt-8 border-t border-border text-center text-sm text-muted-foreground">
        <p>CPA Intern Radar • Daily Intelligence</p>
      </footer>
    </div>
  );
}
