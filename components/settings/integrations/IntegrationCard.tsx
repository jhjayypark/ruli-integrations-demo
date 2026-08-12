import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckIcon, EllipsisVerticalIcon } from "@/components/ui/lucide-shim";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { IntegrationConfig } from "@/lib/integrations";

type IProps = Pick<IntegrationConfig, "name" | "description" | "icon" | "comingSoon"> & {
  isConnected?: boolean;
  isConnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  renderButton?: () => React.ReactNode;
};

export default function IntegrationCard({
  name,
  description,
  icon,
  comingSoon,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
  renderButton,
}: IProps) {
  function _renderButton() {
    if (renderButton) {
      return renderButton();
    }
    if (comingSoon) {
      return (
        <Button disabled variant="outline">
          Coming Soon!
        </Button>
      );
    }
    if (isConnected) {
      return (
        <Button>
          <CheckIcon className="icon mr-2" />
          Connected
        </Button>
      );
    }
    return (
      <LoadingButton variant="outline" loading={isConnecting} onClick={onConnect}>
        Connect
      </LoadingButton>
    );
  }
  return (
    <Card className={cn("space-y-3 p-4", { "order-1": comingSoon })}>
      <div className="flex items-center gap-2">
        <img src={icon} className="mr-auto size-8" alt="logo" />
        {_renderButton()}
        {isConnected && onDisconnect && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <EllipsisVerticalIcon className="icon" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              <DropdownMenuItem className="cursor-pointer text-destructive" onClick={onDisconnect}>
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <h3 className="font-medium">{name}</h3>
      <p className="opacity-70">{description}</p>
    </Card>
  );
}
