import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Briefcase, Activity, BarChart3 } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground mt-1">Live overview of the accounting internship landscape.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Firms Tracked</CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalFirms}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Jobs</CardTitle>
            <Briefcase className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalActiveJobs}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New Today</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">+{stats.newJobsToday}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scans Today</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.firmsScannedToday}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Internship Postings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentJobs.map((job) => (
                <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-card/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{job.firmName}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{job.location || "Multiple Locations"}</span>
                    </div>
                    <div className="font-medium">{job.title}</div>
                  </div>
                  <div className="mt-4 sm:mt-0 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{format(new Date(job.firstSeen), "MMM d, yyyy")}</span>
                    {job.applyUrl && (
                      <a href={job.applyUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                        View Role
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {stats.recentJobs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No recent jobs found.</div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>ATS Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.firmsByAts.map((item) => (
                <div key={item.atsType} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{item.atsType}</span>
                  <span className="text-sm text-muted-foreground">{item.count} firms</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
