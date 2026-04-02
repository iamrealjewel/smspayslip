"use client"
import * as React from "react"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, HelpCircle, Info } from "lucide-react"

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "destructive" | "default" | "info"
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] border-border/50 bg-popover/80 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4">
            <div className={`p-2.5 rounded-2xl shrink-0 ${
              variant === "destructive" ? "bg-red-500/10 text-red-500" : 
              variant === "info" ? "bg-blue-500/10 text-blue-500" : 
              "bg-violet-500/10 text-violet-500"
            }`}>
              {variant === "destructive" ? <AlertCircle className="w-6 h-6" /> : 
               variant === "info" ? <Info className="w-6 h-6" /> :
               <HelpCircle className="w-6 h-6" />}
            </div>
            <div className="flex flex-col gap-1.5 pt-1">
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>
        
        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border/40 flex flex-row sm:justify-end gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="hover:bg-muted font-medium text-xs rounded-xl"
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant === "destructive" ? "destructive" : "default"} 
            onClick={() => { onConfirm(); onClose(); }}
            className={`font-medium text-xs px-6 rounded-xl transition-all active:scale-95 ${
               variant === "default" ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 shadow-lg shadow-violet-600/20" : ""
            }`}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
