import { formatDate } from "@/lib/date-format";

describe("formatDate", () => {
  // Use a known date: Wednesday, March 5, 2025
  const march5 = new Date(2025, 2, 5); // month is 0-indexed

  describe("English format", () => {
    it("formats with ordinal suffix and Month Day, Year layout", () => {
      const result = formatDate("en", march5);
      expect(result).toContain("March");
      expect(result).toContain("5th");
      expect(result).toContain("2025");
      expect(result).toContain("Wednesday");
    });

    it("uses 'st' suffix for day 1", () => {
      const jan1 = new Date(2025, 0, 1);
      const result = formatDate("en", jan1);
      expect(result).toContain("1st");
    });

    it("uses 'nd' suffix for day 2", () => {
      const jan2 = new Date(2025, 0, 2);
      const result = formatDate("en", jan2);
      expect(result).toContain("2nd");
    });

    it("uses 'rd' suffix for day 3", () => {
      const jan3 = new Date(2025, 0, 3);
      const result = formatDate("en", jan3);
      expect(result).toContain("3rd");
    });

    it("uses 'th' suffix for day 4", () => {
      const jan4 = new Date(2025, 0, 4);
      const result = formatDate("en", jan4);
      expect(result).toContain("4th");
    });

    it("uses 'th' suffix for day 11 (special case)", () => {
      const jan11 = new Date(2025, 0, 11);
      const result = formatDate("en", jan11);
      expect(result).toContain("11th");
    });

    it("uses 'th' suffix for day 12 (special case)", () => {
      const jan12 = new Date(2025, 0, 12);
      const result = formatDate("en", jan12);
      expect(result).toContain("12th");
    });

    it("uses 'th' suffix for day 13 (special case)", () => {
      const jan13 = new Date(2025, 0, 13);
      const result = formatDate("en", jan13);
      expect(result).toContain("13th");
    });

    it("uses 'st' suffix for day 21", () => {
      const jan21 = new Date(2025, 0, 21);
      const result = formatDate("en", jan21);
      expect(result).toContain("21st");
    });

    it("uses 'nd' suffix for day 22", () => {
      const jan22 = new Date(2025, 0, 22);
      const result = formatDate("en", jan22);
      expect(result).toContain("22nd");
    });

    it("uses 'rd' suffix for day 23", () => {
      const jan23 = new Date(2025, 0, 23);
      const result = formatDate("en", jan23);
      expect(result).toContain("23rd");
    });

    it("uses 'st' suffix for day 31", () => {
      const jan31 = new Date(2025, 0, 31);
      const result = formatDate("en", jan31);
      expect(result).toContain("31st");
    });
  });

  describe("non-English format", () => {
    it("formats Spanish as Weekday, Day Month Year", () => {
      const result = formatDate("es", march5);
      // Non-English format uses "day month" order without ordinal suffix
      expect(result).toContain("5");
      expect(result).toContain("2025");
      // Should NOT contain English ordinal suffixes
      expect(result).not.toContain("5th");
    });

    it("formats Chinese", () => {
      const result = formatDate("zh", march5);
      expect(result).toContain("5");
      expect(result).toContain("2025");
    });

    it("formats Russian", () => {
      const result = formatDate("ru", march5);
      expect(result).toContain("5");
      expect(result).toContain("2025");
    });
  });

  describe("input handling", () => {
    it("accepts a Date object", () => {
      const result = formatDate("en", march5);
      expect(result).toContain("March");
    });

    it("accepts a millisecond timestamp", () => {
      const result = formatDate("en", march5.getTime());
      expect(result).toContain("March");
      expect(result).toContain("5th");
    });

    it("defaults to current date when no input provided", () => {
      const result = formatDate("en");
      // Should return a non-empty formatted string
      expect(result.length).toBeGreaterThan(0);
      // Should contain current year
      expect(result).toContain(String(new Date().getFullYear()));
    });
  });
});
