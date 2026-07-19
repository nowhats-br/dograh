"use client";

import { useCallback, useState } from "react";

import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { cn } from "@/lib/utils";

// URL regex pattern that validates:
// - http:// or https:// protocol (required)
// - Optional username:password@
// - Domain name or IP address
// - Optional port number
// - Optional path, query string, and fragment
const URL_REGEX =
    /^https?:\/\/(?:[\w-]+(?::[\w-]+)?@)?(?:[\w-]+\.)*[\w-]+(?::\d{1,5})?(?:\/[^\s]*)?$/i;

export interface UrlValidationResult {
    valid: boolean;
    error?: string;
}

export function validateUrl(url: string, t?: (key: string) => string): UrlValidationResult {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
        return { valid: false, error: t ? t("http.urlInput.urlRequired") : "URL is required" };
    }

    if (!URL_REGEX.test(trimmedUrl)) {
        return {
            valid: false,
            error: t ? t("http.urlInput.invalidFormat") : "Invalid URL format. Must start with http:// or https://",
        };
    }

    return { valid: true };
}

interface UrlInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    /** Show validation error styling and message inline */
    showValidation?: boolean;
    /** Called when validation state changes */
    onValidationChange?: (result: UrlValidationResult) => void;
}

export function UrlInput({
    value,
    onChange,
    placeholder,
    disabled = false,
    className,
    showValidation = false,
    onValidationChange,
}: UrlInputProps) {
    const { t } = useTranslation();
    const [touched, setTouched] = useState(false);
    const resolvedPlaceholder = placeholder ?? t("http.urlInput.placeholder");

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            onChange(newValue);

            if (onValidationChange && (touched || newValue)) {
                onValidationChange(validateUrl(newValue, t));
            }
        },
        [onChange, onValidationChange, touched]
    );

    const handleBlur = useCallback(() => {
        setTouched(true);
        const trimmedValue = value.trim();
        if (trimmedValue !== value) {
            onChange(trimmedValue);
        }
        if (onValidationChange && trimmedValue) {
            onValidationChange(validateUrl(trimmedValue, t));
        }
    }, [onChange, onValidationChange, value, t]);

    const validation = validateUrl(value, t);
    const showError = showValidation && touched && !validation.valid && value;

    return (
        <div className="space-y-1">
            <Input
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={resolvedPlaceholder}
                disabled={disabled}
                className={cn(
                    showError && "border-destructive focus-visible:ring-destructive",
                    className
                )}
            />
            {showError && (
                <p className="text-xs text-destructive">{validation.error}</p>
            )}
        </div>
    );
}
