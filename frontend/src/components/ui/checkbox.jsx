import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

// simple tailwind-based checkbox using radix
export const Checkbox = React.forwardRef(({ className, children, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={
      className ||
      'w-4 h-4 rounded border border-border bg-background focus:ring-offset-0 focus:ring-primary/50 flex items-center justify-center'
    }
    {...props}
  >
    <CheckboxPrimitive.Indicator>
      <Check className="w-3 h-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';
