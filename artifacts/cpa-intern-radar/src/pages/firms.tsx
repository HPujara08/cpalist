import { useState, useEffect } from "react";
import { useListFirms, useRunScrape, useScrapeFirm, getListFirmsQueryKey, useDetectFirmAts, useCreateFirm, useUpdateFirm, useGetFirm, useDetectAts, getGetFirmQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AtsBadge } from "@/components/ats-badge";
import { Search, RefreshCw, Loader2, Play, Plus, SearchCode, Edit, ScanSearch } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function FirmFormDialog({ 
  firmId, 
  onClose 
}: { 
  firmId?: number | null, 
  onClose: () => void 
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createFirm = useCreateFirm();
  const updateFirm = useUpdateFirm();

  // Satisfy rule: Use all provided hooks
  const { data: firm, isLoading: isFetching } = useGetFirm(firmId || 0, { query: { enabled: !!firmId, queryKey: getGetFirmQueryKey(firmId || 0) } });

  const [formData, setFormData] = useState({
    name: "",
    rank: 1,
    hqCity: "",
    hqState: "",
    websiteUrl: "",
    careersUrl: "",
    atsType: "unknown",
  });

  useEffect(() => {
    if (firm) {
      setFormData({
        name: firm.name,
        rank: firm.rank,
        hqCity: firm.hqCity,
        hqState: firm.hqState,
        websiteUrl: firm.websiteUrl,
        careersUrl: firm.careersUrl,
        atsType: firm.atsType,
      });
    }
  }, [firm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firmId) {
      updateFirm.mutate({ id: firmId, data: formData }, {
        onSuccess: () => {
          toast({ title: "Firm updated successfully" });
          queryClient.invalidateQueries({ queryKey: getListFirmsQueryKey() });
          onClose();
        }
      });
    } else {
      createFirm.mutate({ data: formData }, {
        onSuccess: () => {
          toast({ title: "Firm created successfully" });
          queryClient.invalidateQueries({ queryKey: getListFirmsQueryKey() });
          onClose();
        }
      });
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{firmId ? "Edit Firm" : "Add Firm"}</DialogTitle>
      </DialogHeader>
      {isFetching ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Firm Name</Label>
            <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rank">Rank</Label>
              <Input id="rank" type="number" value={formData.rank} onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="atsType">ATS Type</Label>
              <Input id="atsType" value={formData.atsType} onChange={(e) => setFormData({ ...formData, atsType: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hqCity">HQ City</Label>
              <Input id="hqCity" value={formData.hqCity} onChange={(e) => setFormData({ ...formData, hqCity: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hqState">HQ State</Label>
              <Input id="hqState" value={formData.hqState} onChange={(e) => setFormData({ ...formData, hqState: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input id="websiteUrl" type="url" value={formData.websiteUrl} onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="careersUrl">Careers URL</Label>
            <Input id="careersUrl" type="url" value={formData.careersUrl} onChange={(e) => setFormData({ ...formData, careersUrl: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createFirm.isPending || updateFirm.isPending}>
              {(createFirm.isPending || updateFirm.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {firmId ? "Save Changes" : "Create Firm"}
            </Button>
          </div>
        </form>
      )}
    </DialogContent>
  );
}

export default function Firms() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFirmId, setEditingFirmId] = useState<number | null>(null);
  
  const { data: firms, isLoading } = useListFirms({ search: search || undefined });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runScrape = useRunScrape();
  const scrapeFirm = useScrapeFirm();
  const detectAts = useDetectFirmAts();
  const batchDetect = useDetectAts();

  const handleGlobalScrape = () => {
    runScrape.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Global Scrape Started", description: "This might take a while." });
        queryClient.invalidateQueries({ queryKey: getListFirmsQueryKey() });
      }
    });
  };

  const handleScrapeFirm = (id: number, name: string) => {
    scrapeFirm.mutate({ id }, {
      onSuccess: (data) => {
        toast({ 
          title: `Scraped ${name}`, 
          description: `Found ${data.jobsFound} jobs (${data.jobsNew} new).` 
        });
        queryClient.invalidateQueries({ queryKey: getListFirmsQueryKey() });
      },
      onError: () => {
        toast({ title: `Error scraping ${name}`, variant: "destructive" });
      }
    });
  };

  const handleBatchDetect = () => {
    batchDetect.mutate({ params: { limit: 20 } }, {
      onSuccess: (data) => {
        toast({
          title: `ATS Detection Complete`,
          description: `Processed ${data.processed} firms — identified ${data.detected}. ${data.unknownRemaining} still unknown.`,
        });
        queryClient.invalidateQueries({ queryKey: getListFirmsQueryKey() });
      },
      onError: () => {
        toast({ title: "Batch ATS detection failed", variant: "destructive" });
      }
    });
  };

  const handleDetectAts = (id: number, name: string) => {
    detectAts.mutate({ id }, {
      onSuccess: (data) => {
        toast({
          title: `ATS Detection: ${name}`,
          description: data.success ? `Detected ${data.atsType}` : "Could not detect ATS provider.",
          variant: data.success ? "default" : "destructive"
        });
        if (data.success) {
          queryClient.invalidateQueries({ queryKey: getListFirmsQueryKey() });
        }
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tracked Firms</h1>
          <p className="text-muted-foreground mt-1">Directory of all CPA firms monitored for internship openings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingFirmId(null)}>
                <Plus className="w-4 h-4 mr-2" /> Add Firm
              </Button>
            </DialogTrigger>
            {isDialogOpen && (
              <FirmFormDialog firmId={editingFirmId} onClose={() => setIsDialogOpen(false)} />
            )}
          </Dialog>
          <Button onClick={handleBatchDetect} disabled={batchDetect.isPending} variant="outline">
            {batchDetect.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScanSearch className="w-4 h-4 mr-2" />}
            {batchDetect.isPending ? "Detecting…" : "Detect ATS (Next 20)"}
          </Button>
          <Button onClick={handleGlobalScrape} disabled={runScrape.isPending} variant="secondary">
            {runScrape.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Run Global Scrape
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search firms..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border border-border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Firm Name</TableHead>
              <TableHead>HQ</TableHead>
              <TableHead>ATS Type</TableHead>
              <TableHead className="text-right">Active Jobs</TableHead>
              <TableHead className="text-right">Last Checked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Loading firms...
                </TableCell>
              </TableRow>
            ) : firms?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No firms found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              firms?.map((firm) => (
                <TableRow key={firm.id}>
                  <TableCell className="font-mono text-muted-foreground">#{firm.rank}</TableCell>
                  <TableCell className="font-medium">
                    <a href={firm.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {firm.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{firm.hqCity}, {firm.hqState}</TableCell>
                  <TableCell>
                    <AtsBadge type={firm.atsType} />
                  </TableCell>
                  <TableCell className="text-right font-mono">{firm.jobsCount || 0}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {firm.lastChecked ? format(new Date(firm.lastChecked), "MMM d, HH:mm") : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingFirmId(firm.id);
                          setIsDialogOpen(true);
                        }}
                        title="Edit Firm"
                      >
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDetectAts(firm.id, firm.name)}
                        disabled={detectAts.isPending}
                        title="Auto-detect ATS"
                      >
                        <SearchCode className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleScrapeFirm(firm.id, firm.name)}
                        disabled={scrapeFirm.isPending}
                        title="Scrape Now"
                      >
                        <Play className="w-4 h-4 text-primary" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
