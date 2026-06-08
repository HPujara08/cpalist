import { useState } from "react";
import { useListJobs, useListFirms } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AtsBadge } from "@/components/ats-badge";
import { Search, ExternalLink, MapPin, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";

export default function Jobs() {
  const [search, setSearch] = useState("");
  const [firmId, setFirmId] = useState<string>("all");
  const [atsSource, setAtsSource] = useState<string>("all");
  const [term, setTerm] = useState<string>("all");

  const { data: firms } = useListFirms();

  const { data: jobs, isLoading } = useListJobs({ 
    search: search || undefined,
    firm_id: firmId !== "all" ? parseInt(firmId) : undefined,
    ats_source: atsSource !== "all" ? atsSource : undefined,
    term: term !== "all" ? term : undefined,
    is_active: true
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Intelligence</h1>
        <p className="text-muted-foreground mt-1">Searchable database of all active accounting internship postings.</p>
      </div>

      <div className="p-4 border border-border bg-card rounded-lg flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
          <Filter className="w-4 h-4" /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search titles, locations..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={firmId} onValueChange={setFirmId}>
            <SelectTrigger>
              <SelectValue placeholder="All Firms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Firms</SelectItem>
              {firms?.map(firm => (
                <SelectItem key={firm.id} value={firm.id.toString()}>{firm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={atsSource} onValueChange={setAtsSource}>
            <SelectTrigger>
              <SelectValue placeholder="All ATS Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ATS Sources</SelectItem>
              <SelectItem value="workday">Workday</SelectItem>
              <SelectItem value="greenhouse">Greenhouse</SelectItem>
              <SelectItem value="lever">Lever</SelectItem>
              <SelectItem value="icims">iCIMS</SelectItem>
              <SelectItem value="smartrecruiters">SmartRecruiters</SelectItem>
              <SelectItem value="ashby">Ashby</SelectItem>
            </SelectContent>
          </Select>

          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger>
              <SelectValue placeholder="All Terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms</SelectItem>
              <SelectItem value="summer">Summer</SelectItem>
              <SelectItem value="winter">Winter</SelectItem>
              <SelectItem value="spring">Spring</SelectItem>
              <SelectItem value="fall">Fall</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading jobs...</div>
      ) : jobs?.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-lg bg-card/50">
          <p className="text-muted-foreground">No active jobs found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs?.map((job) => (
            <div key={job.id} className="group relative flex flex-col p-5 border border-border rounded-xl bg-card hover:border-primary/50 transition-colors shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-primary mb-1">{job.firmName}</div>
                  <h3 className="font-bold text-lg leading-tight line-clamp-2">{job.title}</h3>
                </div>
                <AtsBadge type={job.atsSource} />
              </div>
              
              <div className="mt-auto pt-4 flex flex-col gap-2">
                {job.location && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 opacity-70" />
                    {job.location}
                  </div>
                )}
                {job.term && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2 opacity-70" />
                    {job.term}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  Seen {format(new Date(job.firstSeen), "MMM d")}
                </span>
                {job.applyUrl && (
                  <a 
                    href={job.applyUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Apply <ExternalLink className="w-3 h-3 ml-2" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
