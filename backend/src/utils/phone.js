const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

export const normalizePhone = (value, countryCode = "595") => {
  let digits = onlyDigits(value);
  const cleanCountryCode = onlyDigits(countryCode);

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(cleanCountryCode)) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length >= 8 && digits.length <= 12) {
    return `${cleanCountryCode}${digits}`;
  }
  return digits;
};

export const isValidPhone = (value) => /^\d{10,15}$/.test(String(value || ""));

export const buildWhatsAppLink = (phone, message = "") => {
  const base = `https://wa.me/${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
