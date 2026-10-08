import { Children, useRef, useState } from "react";
import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { getNonce } from "get-nonce";

// Same value/onChange and FormData contract as our original controls.
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  className = "",
  ...props
}) {
  const trigger = useRef(null);
  const [container, setContainer] = useState(undefined);
  const options = Children.toArray(children).filter(Boolean);
  const placeholder = options.find((option) => option.props?.value === "")
    ?.props.children;
  return (
    <Primitive.Root
      name={name}
      value={value}
      defaultValue={defaultValue}
      required={required}
      disabled={disabled}
      onValueChange={(next) => onChange?.({ target: { value: next, name } })}
      onOpenChange={(open) => {
        if (open)
          setContainer(trigger.current?.closest("dialog") || document.body);
      }}
    >
      <Primitive.Trigger
        {...props}
        ref={trigger}
        className={`select-trigger ${className}`}
      >
        <Primitive.Value placeholder={placeholder || "Select an option"} />
        <Primitive.Icon>
          <ChevronDown size={14} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal container={container}>
        <Primitive.Content
          className="select-menu"
          position="popper"
          sideOffset={5}
          collisionPadding={12}
        >
          <Primitive.ScrollUpButton className="select-scroll">
            <ChevronUp size={14} />
          </Primitive.ScrollUpButton>
          <Primitive.Viewport className="select-options" nonce={getNonce()}>
            {options
              .filter((option) => option.props?.value !== "")
              .map((option) => (
                <Primitive.Item
                  key={option.props.value}
                  value={String(option.props.value)}
                  disabled={option.props.disabled}
                  className="select-option"
                >
                  <Primitive.ItemText>
                    {option.props.children}
                  </Primitive.ItemText>
                  <Primitive.ItemIndicator>
                    <Check size={14} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="select-scroll">
            <ChevronDown size={14} />
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
