import { Badge } from "@/components/ui/badge";

export function AtsBadge({ type }: { type: string }) {
  const normalizedType = type.toLowerCase();
  
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let className = "text-xs font-mono uppercase tracking-wider";
  
  switch (normalizedType) {
    case "workday":
      className += " bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800";
      break;
    case "greenhouse":
      className += " bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800";
      break;
    case "lever":
      className += " bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-800";
      break;
    case "icims":
      className += " bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-800";
      break;
    case "smartrecruiters":
      className += " bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900 dark:text-teal-300 dark:border-teal-800";
      break;
    case "ashby":
      className += " bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900 dark:text-pink-300 dark:border-pink-800";
      break;
    case "jobvite":
      className += " bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-800";
      break;
    case "custom":
      className += " bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
      break;
    default:
      className += " bg-muted text-muted-foreground border-muted-foreground/20";
      break;
  }

  return (
    <Badge variant={variant} className={className}>
      {type}
    </Badge>
  );
}
