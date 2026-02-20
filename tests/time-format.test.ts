import {
  formatWaitTime,
  formatWaitTimeAsHoursAndMinutes,
} from "@/lib/time-format";

describe("formatWaitTime", () => {
  describe("English", () => {
    it("formats singular minute", () => {
      expect(formatWaitTime(1, "en")).toBe("1 minute");
    });

    it("formats plural minutes", () => {
      expect(formatWaitTime(5, "en")).toBe("5 minutes");
    });

    it("formats exactly 1 hour", () => {
      expect(formatWaitTime(60, "en")).toBe("1 hour");
    });

    it("formats exactly 2 hours", () => {
      expect(formatWaitTime(120, "en")).toBe("2 hours");
    });

    it("formats hours and minutes combined", () => {
      expect(formatWaitTime(61, "en")).toBe("1 hour, 1 minute");
    });

    it("formats multiple hours and multiple minutes", () => {
      expect(formatWaitTime(125, "en")).toBe("2 hours, 5 minutes");
    });

    it("formats 59 minutes (no hours)", () => {
      expect(formatWaitTime(59, "en")).toBe("59 minutes");
    });
  });

  describe("Chinese (invariant form)", () => {
    it("formats minutes", () => {
      expect(formatWaitTime(5, "zh")).toBe("5分钟");
    });

    it("formats hours", () => {
      expect(formatWaitTime(60, "zh")).toBe("1小时");
    });

    it("formats hours and minutes", () => {
      expect(formatWaitTime(65, "zh")).toBe("1小时, 5分钟");
    });
  });

  describe("Spanish (singular/plural)", () => {
    it("formats singular minute", () => {
      expect(formatWaitTime(1, "es")).toBe("1 minuto");
    });

    it("formats plural minutes", () => {
      expect(formatWaitTime(2, "es")).toBe("2 minutos");
    });

    it("formats singular hour", () => {
      expect(formatWaitTime(60, "es")).toBe("1 hora");
    });

    it("formats plural hours", () => {
      expect(formatWaitTime(120, "es")).toBe("2 horas");
    });
  });

  describe("Russian (3-form plurals)", () => {
    it("uses singular for 1", () => {
      expect(formatWaitTime(1, "ru")).toBe("1 минута");
    });

    it("uses paucal for 2-4", () => {
      expect(formatWaitTime(2, "ru")).toBe("2 минуты");
      expect(formatWaitTime(3, "ru")).toBe("3 минуты");
      expect(formatWaitTime(4, "ru")).toBe("4 минуты");
    });

    it("uses plural for 5-20", () => {
      expect(formatWaitTime(5, "ru")).toBe("5 минут");
      expect(formatWaitTime(11, "ru")).toBe("11 минут");
      expect(formatWaitTime(14, "ru")).toBe("14 минут");
    });

    it("uses singular for 21", () => {
      expect(formatWaitTime(21, "ru")).toBe("21 минута");
    });

    it("uses paucal for 22-24", () => {
      expect(formatWaitTime(22, "ru")).toBe("22 минуты");
    });

    it("uses correct hour plurals", () => {
      expect(formatWaitTime(60, "ru")).toBe("1 час");
      expect(formatWaitTime(120, "ru")).toBe("2 часа");
      expect(formatWaitTime(300, "ru")).toBe("5 часов");
    });
  });

  describe("Ukrainian (3-form plurals)", () => {
    it("uses singular for 1", () => {
      expect(formatWaitTime(1, "uk")).toBe("1 хвилина");
    });

    it("uses paucal for 2-4", () => {
      expect(formatWaitTime(2, "uk")).toBe("2 хвилини");
    });

    it("uses plural for 5+", () => {
      expect(formatWaitTime(5, "uk")).toBe("5 хвилин");
      expect(formatWaitTime(11, "uk")).toBe("11 хвилин");
    });

    it("uses correct hour plurals", () => {
      expect(formatWaitTime(60, "uk")).toBe("1 година");
      expect(formatWaitTime(120, "uk")).toBe("2 години");
      expect(formatWaitTime(300, "uk")).toBe("5 годин");
    });
  });

  describe("Arabic (singular/plural)", () => {
    it("formats singular minute", () => {
      expect(formatWaitTime(1, "ar")).toBe("1 دقيقة");
    });

    it("formats plural minutes", () => {
      expect(formatWaitTime(2, "ar")).toBe("2 دقائق");
    });

    it("formats singular hour", () => {
      expect(formatWaitTime(60, "ar")).toBe("1 ساعة");
    });

    it("formats plural hours", () => {
      expect(formatWaitTime(120, "ar")).toBe("2 ساعات");
    });
  });

  describe("Vietnamese", () => {
    it("formats minutes", () => {
      expect(formatWaitTime(5, "vi")).toBe("5 phút");
    });

    it("formats hours", () => {
      expect(formatWaitTime(60, "vi")).toBe("1 giờ");
    });
  });

  describe("Persian", () => {
    it("formats minutes", () => {
      expect(formatWaitTime(5, "fa")).toBe("5 دقیقه");
    });

    it("formats hours", () => {
      expect(formatWaitTime(60, "fa")).toBe("1 ساعت");
    });
  });
});

describe("formatWaitTimeAsHoursAndMinutes", () => {
  it("shows only minutes when under 1 hour", () => {
    expect(formatWaitTimeAsHoursAndMinutes(45, "en")).toBe("45 minutes");
  });

  it("shows hours and minutes when over 1 hour", () => {
    expect(formatWaitTimeAsHoursAndMinutes(75, "en")).toBe(
      "1 hour 15 minutes",
    );
  });

  it("clamps negative minutes to 0", () => {
    expect(formatWaitTimeAsHoursAndMinutes(-5, "en")).toBe("0 minutes");
  });

  it("rounds fractional minutes", () => {
    expect(formatWaitTimeAsHoursAndMinutes(5.7, "en")).toBe("6 minutes");
    expect(formatWaitTimeAsHoursAndMinutes(5.3, "en")).toBe("5 minutes");
  });

  it("shows 0 minutes for zero input", () => {
    expect(formatWaitTimeAsHoursAndMinutes(0, "en")).toBe("0 minutes");
  });

  it("uses space separator (not comma) between hours and minutes", () => {
    const result = formatWaitTimeAsHoursAndMinutes(90, "en");
    expect(result).toBe("1 hour 30 minutes");
    expect(result).not.toContain(",");
  });
});
