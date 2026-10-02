import React, { useMemo, useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, font, spacing } from "@/src/theme";
import { todayISO, yesterdayISO } from "@/src/format";

interface DatePickerModalProps {
  visible: boolean;
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  onClose: () => void;
  title?: string;
  maxDate?: string; // e.g. todayISO()
  minDate?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function DatePickerModal({
  visible,
  value,
  onChange,
  onClose,
  title = "Select Date",
  maxDate,
  minDate,
}: DatePickerModalProps) {
  const today = todayISO();
  const initialDate = value || today;

  // Selected date (temporary until confirmed or auto-applied)
  const [selected, setSelected] = useState<string>(initialDate);

  // View year and month index (0-11)
  const [viewYear, setViewYear] = useState<number>(() => {
    const parts = (value || today).split("-");
    return parseInt(parts[0], 10) || new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    const parts = (value || today).split("-");
    const m = parseInt(parts[1], 10);
    return !isNaN(m) && m >= 1 && m <= 12 ? m - 1 : new Date().getMonth();
  });

  // Sync internal state whenever modal opens or value changes
  useEffect(() => {
    if (visible) {
      const active = value || today;
      setSelected(active);
      const parts = active.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y)) setViewYear(y);
        if (!isNaN(m) && m >= 0 && m <= 11) setViewMonth(m);
      }
    }
  }, [visible, value]);

  const handlePrevMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handlePrevYear = () => {
    Haptics.selectionAsync().catch(() => {});
    setViewYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    Haptics.selectionAsync().catch(() => {});
    setViewYear((prev) => prev + 1);
  };

  // Calendar day cells calculation
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    type Cell = {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isSelected: boolean;
      isToday: boolean;
    };

    const cells: Cell[] = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${pad2(prevM + 1)}-${pad2(day)}`;
      const isDisabled = (!!maxDate && dateStr > maxDate) || (!!minDate && dateStr < minDate);
      cells.push({
        day,
        dateStr,
        isCurrentMonth: false,
        isDisabled,
        isSelected: dateStr === selected,
        isToday: dateStr === today,
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
      const isDisabled = (!!maxDate && dateStr > maxDate) || (!!minDate && dateStr < minDate);
      cells.push({
        day,
        dateStr,
        isCurrentMonth: true,
        isDisabled,
        isSelected: dateStr === selected,
        isToday: dateStr === today,
      });
    }

    // Trailing days to fill standard 35 or 42 grid
    const totalSlots = cells.length > 35 ? 42 : 35;
    const remaining = totalSlots - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${pad2(nextM + 1)}-${pad2(day)}`;
      const isDisabled = (!!maxDate && dateStr > maxDate) || (!!minDate && dateStr < minDate);
      cells.push({
        day,
        dateStr,
        isCurrentMonth: false,
        isDisabled,
        isSelected: dateStr === selected,
        isToday: dateStr === today,
      });
    }

    return cells;
  }, [viewYear, viewMonth, selected, maxDate, minDate, today]);

  const handleSelectDate = (dateStr: string, isCurrentMonth: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected(dateStr);
    if (!isCurrentMonth) {
      const parts = dateStr.split("-");
      setViewYear(parseInt(parts[0], 10));
      setViewMonth(parseInt(parts[1], 10) - 1);
    }
  };

  const handleApplyPreset = (dateStr: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected(dateStr);
    const parts = dateStr.split("-");
    setViewYear(parseInt(parts[0], 10));
    setViewMonth(parseInt(parts[1], 10) - 1);
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onChange(selected);
    onClose();
  };

  // Helper date strings for presets
  const yesterday = yesterdayISO();
  const threeDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  }, []);
  const oneWeekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const firstOfMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  }, []);

  const formatDisplay = (iso: string) => {
    if (!iso) return "";
    try {
      const parts = iso.split("-");
      if (parts.length !== 3) return iso;
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("en-MY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.calendarIconBubble}>
                <Ionicons name="calendar" size={18} color={colors.brandPrimary} />
              </View>
              <Text style={styles.headerTitle}>{title}</Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          {/* Quick Preset Chips */}
          <View style={styles.presetContainer}>
            <Text style={styles.presetLabel}>QUICK SHORTCUTS</Text>
            <View style={styles.presetsRow}>
              <Pressable
                style={[styles.presetChip, selected === today && styles.presetChipActive]}
                onPress={() => handleApplyPreset(today)}
              >
                <Text style={[styles.presetChipText, selected === today && styles.presetChipTextActive]}>
                  ⚡ Today
                </Text>
              </Pressable>

              <Pressable
                style={[styles.presetChip, selected === yesterday && styles.presetChipActive]}
                onPress={() => handleApplyPreset(yesterday)}
              >
                <Text style={[styles.presetChipText, selected === yesterday && styles.presetChipTextActive]}>
                  🗓️ Yesterday
                </Text>
              </Pressable>

              <Pressable
                style={[styles.presetChip, selected === threeDaysAgo && styles.presetChipActive]}
                onPress={() => handleApplyPreset(threeDaysAgo)}
              >
                <Text style={[styles.presetChipText, selected === threeDaysAgo && styles.presetChipTextActive]}>
                  ⏪ -3d
                </Text>
              </Pressable>

              <Pressable
                style={[styles.presetChip, selected === oneWeekAgo && styles.presetChipActive]}
                onPress={() => handleApplyPreset(oneWeekAgo)}
              >
                <Text style={[styles.presetChipText, selected === oneWeekAgo && styles.presetChipTextActive]}>
                  📅 -7d
                </Text>
              </Pressable>

              <Pressable
                style={[styles.presetChip, selected === firstOfMonth && styles.presetChipActive]}
                onPress={() => handleApplyPreset(firstOfMonth)}
              >
                <Text style={[styles.presetChipText, selected === firstOfMonth && styles.presetChipTextActive]}>
                  🎯 1st
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Month / Year Navigator */}
          <View style={styles.monthNavRow}>
            <View style={styles.navButtonPair}>
              <Pressable hitSlop={8} onPress={handlePrevYear} style={styles.navBtnSmall}>
                <Ionicons name="play-back" size={14} color={colors.onSurfaceSecondary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={handlePrevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.monthLabelContainer}>
              <Text style={styles.monthLabelText}>
                {MONTH_NAMES[viewMonth]} <Text style={styles.yearText}>{viewYear}</Text>
              </Text>
            </View>

            <View style={styles.navButtonPair}>
              <Pressable hitSlop={8} onPress={handleNextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
              </Pressable>
              <Pressable hitSlop={8} onPress={handleNextYear} style={styles.navBtnSmall}>
                <Ionicons name="play-forward" size={14} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((wd, i) => (
              <View key={wd + i} style={styles.weekdayCol}>
                <Text
                  style={[
                    styles.weekdayText,
                    (i === 0 || i === 6) && styles.weekendText,
                  ]}
                >
                  {wd}
                </Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.gridContainer}>
            {calendarCells.map((cell, idx) => {
              const isSelected = cell.isSelected;
              const isToday = cell.isToday;
              const isMuted = !cell.isCurrentMonth;
              const isDisabled = cell.isDisabled;

              return (
                <Pressable
                  key={cell.dateStr + idx}
                  disabled={isDisabled}
                  onPress={() => handleSelectDate(cell.dateStr, cell.isCurrentMonth)}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    !isSelected && isToday && styles.dayCellToday,
                    isDisabled && styles.dayCellDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isMuted && styles.dayTextMuted,
                      isSelected && styles.dayTextSelected,
                      !isSelected && isToday && styles.dayTextToday,
                      isDisabled && styles.dayTextDisabled,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {isToday && !isSelected && <View style={styles.todayDot} />}
                </Pressable>
              );
            })}
          </View>

          {/* Selected Date Summary & Action Buttons */}
          <View style={styles.footer}>
            <View style={styles.selectedPreview}>
              <Text style={styles.selectedPreviewLabel}>SELECTED</Text>
              <Text style={styles.selectedPreviewValue}>
                {formatDisplay(selected)}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
                <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.confirmBtnText}>Apply Date</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    width: "100%",
    maxWidth: 380,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calendarIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  closeBtn: {
    padding: 4,
  },
  presetContainer: {
    marginBottom: 14,
  },
  presetLabel: {
    fontSize: 10,
    fontFamily: font.bold,
    color: colors.onSurfaceSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  presetChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  presetChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: font.medium,
    color: colors.onSurface,
  },
  presetChipTextActive: {
    color: "#FFFFFF",
    fontFamily: font.bold,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginBottom: 8,
  },
  navButtonPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.8,
  },
  monthLabelContainer: {
    alignItems: "center",
  },
  monthLabelText: {
    fontSize: 15,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  yearText: {
    color: colors.brandPrimary,
    fontFamily: font.black,
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 6,
  },
  weekdayCol: {
    width: 38,
    alignItems: "center",
  },
  weekdayText: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.onSurfaceSecondary,
  },
  weekendText: {
    color: colors.brandPrimary,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    rowGap: 6,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dayCellSelected: {
    backgroundColor: colors.brandPrimary,
    ...shadow.glow,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surfaceTertiary,
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayText: {
    fontSize: 13,
    fontFamily: font.medium,
    color: colors.onSurface,
  },
  dayTextMuted: {
    color: "#94A3B8",
    opacity: 0.6,
  },
  dayTextSelected: {
    color: "#FFFFFF",
    fontFamily: font.bold,
  },
  dayTextToday: {
    color: colors.brandPrimary,
    fontFamily: font.bold,
  },
  dayTextDisabled: {
    color: "#CBD5E1",
  },
  todayDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brandPrimary,
  },
  footer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  selectedPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  selectedPreviewLabel: {
    fontSize: 10,
    fontFamily: font.bold,
    color: colors.onSurfaceSecondary,
    letterSpacing: 0.8,
  },
  selectedPreviewValue: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
  },
  confirmBtn: {
    flex: 1.5,
    flexDirection: "row",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    ...shadow.glow,
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: font.bold,
    color: "#FFFFFF",
  },
});
