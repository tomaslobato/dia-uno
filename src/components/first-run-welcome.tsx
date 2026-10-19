import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Pressable from '@/components/feedback-pressable';
import { HabitsWelcomeGuide } from '@/components/habits-welcome';
import { useAppearance } from '@/theme/appearance';

export default function FirstRunWelcome({ owner }: { owner: string }) {
  const { preferences, surface, text: textColor, muted, border } = useAppearance();
  const modalSurface = preferences.dark ? '#30343c' : surface;
  const modalText = preferences.dark ? '#f2f4f8' : textColor;
  const modalMuted = preferences.dark ? '#c3c9d2' : muted;
  const modalBorder = preferences.dark ? '#515965' : border;
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const storageKey = `diauno.welcome.${owner}.v1`;
  const habitWelcomeKey = `mejordia.habits-welcome.${owner}.v1`;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then((seen) => {
      if (active) { setVisible(seen !== 'seen'); setReady(true); }
    }).catch(() => { if (active) { setVisible(true); setReady(true); } });
    return () => { active = false; };
  }, [storageKey]);

  function finish() {
    if (saving) return;
    setSaving(true);
    void Promise.all([
      AsyncStorage.setItem(storageKey, 'seen'),
      AsyncStorage.setItem(habitWelcomeKey, 'seen'),
    ]).then(() => {
      setVisible(false);
      setError(false);
      router.navigate({ pathname: '/ajustes', params: { focus: 'personalizacion' } });
    }).catch(() => setError(true)).finally(() => setSaving(false));
  }

  function back() {
    if (slide > 0) setSlide((current) => current - 1);
  }

  if (!ready || !visible) return null;
  const accents = [preferences.tasks, preferences.habits, preferences.agenda];
  const accent = accents[slide] ?? preferences.tasks;
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={back}>
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
      <View style={[styles.sheet, { backgroundColor: modalSurface, borderColor: modalBorder }]}>
        <View style={styles.progressRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" disabled={slide === 0} onPress={back} style={[styles.back, slide === 0 && styles.backHidden]}><MaterialIcons name="arrow-back" size={21} color={modalMuted} /></Pressable>
          <View style={styles.progress}>{[0, 1, 2].map((index) => <View key={index} style={[styles.progressDot, { backgroundColor: index === slide ? accent : modalBorder }]} />)}</View>
          <View style={styles.back} />
        </View>
        {slide === 0 && <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.brandMark, { backgroundColor: `${preferences.tasks}18`, borderColor: preferences.tasks }]}><MaterialIcons name="checklist" size={28} color={preferences.tasks} /></View>
            <Text accessibilityRole="header" style={[styles.title, { color: modalText }]}>Día Uno</Text>
            <Text style={[styles.subtitle, { color: modalMuted }]}>Organizá tu vida y llegá a tu máximo potencial.</Text>
            <TaskPreview accent={preferences.tasks} surface={preferences.dark ? '#292e36' : surface} border={modalBorder} textColor={modalText} muted={modalMuted} />
          </ScrollView>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => setSlide(1)} style={[styles.button, { backgroundColor: preferences.habits }]}><Text style={styles.buttonText}>Hábitos</Text><MaterialIcons name="arrow-forward" size={20} color="#fff" /></Pressable>
        </>}
        {slide === 1 && <View style={styles.guideWrap}><HabitsWelcomeGuide buttonLabel="Agenda" showArrow brightenDark fixedFooter buttonColor={preferences.agenda} onContinue={() => setSlide(2)} /></View>}
        {slide === 2 && <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.brandMark, { backgroundColor: `${preferences.agenda}18`, borderColor: preferences.agenda }]}><MaterialIcons name="calendar-month" size={27} color={preferences.agenda} /></View>
            <Text accessibilityRole="header" style={[styles.title, { color: modalText }]}>Agenda</Text>
            <Text style={[styles.subtitle, { color: modalMuted }]}>Una vista completa de tus tareas y hábitos.</Text>
            <AgendaPreview tasks={preferences.tasks} habits={preferences.habits} agenda={preferences.agenda} surface={preferences.dark ? '#292e36' : surface} border={modalBorder} textColor={modalText} muted={modalMuted} />
            <View style={styles.captionRow}>
              <View style={[styles.caption, { borderColor: modalBorder }]}><MaterialIcons name="calendar-view-month" size={18} color={preferences.agenda} /><Text style={[styles.captionText, { color: modalText }]}>Calendario</Text></View>
              <View style={[styles.caption, { borderColor: modalBorder }]}><MaterialIcons name="view-week" size={18} color={preferences.agenda} /><Text style={[styles.captionText, { color: modalText }]}>Vista de 3 días</Text></View>
            </View>
          </ScrollView>
          {error && <Text style={[styles.error, { color: preferences.habits }]}>No pudimos guardar tus preferencias iniciales. Intenta de nuevo.</Text>}
          <Pressable accessibilityRole="button" disabled={saving} onPress={finish} style={[styles.button, { backgroundColor: '#1a73e8' }]}><Text style={styles.buttonText}>{saving ? 'Guardando…' : 'Personalizar'}</Text><MaterialIcons name="arrow-forward" size={20} color="#fff" /></Pressable>
        </>}
      </View>
    </View>
  </Modal>;
}

function TaskPreview({ accent, surface, border, textColor, muted }: { accent: string; surface: string; border: string; textColor: string; muted: string }) {
  return <View style={[styles.previewCard, { backgroundColor: surface, borderColor: border }]}>
    <View style={styles.previewHeader}><Text style={[styles.previewTitle, { color: textColor }]}>Mis tareas</Text><Text style={[styles.previewMeta, { color: muted }]}>Hoy</Text></View>
    <View style={styles.listPreview}>
      <View style={[styles.listChip, { backgroundColor: `${accent}18` }]}><Text style={[styles.listChipText, { color: accent }]}>Todo</Text></View>
      <View style={[styles.listChip, { borderColor: border }]}><Text style={[styles.listChipText, { color: muted }]}>Trabajo</Text></View>
      <View style={[styles.listChip, { borderColor: border }]}><Text style={[styles.listChipText, { color: muted }]}>Personal</Text></View>
      <View accessibilityLabel="Crear lista" style={[styles.addListChip, { borderColor: `${accent}70` }]}><MaterialIcons name="add" size={14} color={accent} /></View>
    </View>
    {['Enviar el informe', 'Pagar la factura de internet', 'Hacer la compra'].map((task, index) => <View key={task} style={[styles.taskLine, index < 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }]}>
      <View style={[styles.checkbox, { borderColor: accent }]} /><Text numberOfLines={1} style={[styles.taskText, { color: textColor }]}>{task}</Text>{index === 0 && <MaterialIcons name="star" size={17} color="#e3aa33" />}
    </View>)}
    <View style={[styles.previewAdd, { backgroundColor: `${accent}18` }]}><MaterialIcons name="add" size={18} color={accent} /><Text style={[styles.previewAddText, { color: accent }]}>Nueva tarea</Text></View>
  </View>;
}

function AgendaPreview({ tasks, habits, agenda, surface, border, textColor, muted }: { tasks: string; habits: string; agenda: string; surface: string; border: string; textColor: string; muted: string }) {
  const calendarDays = Array.from({ length: 35 }, (_, index) => {
    const date = index - 2;
    return date > 0 && date <= 31 ? date : null;
  });
  return <View style={[styles.agendaCard, { backgroundColor: surface, borderColor: border }]}>
    <View style={styles.agendaTop}><Text style={[styles.month, { color: textColor }]}>Octubre</Text><View style={[styles.viewPill, { backgroundColor: `${agenda}18` }]}><Text style={[styles.viewPillText, { color: agenda }]}>Calendario</Text></View></View>
    <View style={styles.weekdayRow}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekday, { color: muted }]}>{day}</Text>)}</View>
    <View style={styles.calendarGrid}>{calendarDays.map((date, index) => <View key={index} style={[styles.calendarCell, date === 19 && { backgroundColor: `${agenda}18` }]}>
      {date && <>
        <Text style={[styles.calendarDate, { color: date === 19 ? agenda : textColor }]}>{date}</Text>
        <View style={styles.eventDots}>{date % 5 !== 0 && <View style={[styles.eventDot, { backgroundColor: tasks }]} />}{date % 3 !== 0 && <View style={[styles.eventDot, { backgroundColor: habits }]} />}</View>
      </>}
    </View>)}</View>
    <View style={styles.agendaEntries}>
      <View style={[styles.agendaEntry, { backgroundColor: `${tasks}20` }]}><View style={[styles.entryMarker, { backgroundColor: tasks }]} /><Text style={[styles.entryText, { color: textColor }]}>Enviar el informe</Text><Text style={[styles.entryTime, { color: muted }]}>10:30</Text></View>
      <View style={[styles.agendaEntry, { backgroundColor: `${tasks}20` }]}><View style={[styles.entryMarker, { backgroundColor: tasks }]} /><Text style={[styles.entryText, { color: textColor }]}>Hacer la compra</Text><Text style={[styles.entryTime, { color: muted }]}>16:00</Text></View>
      <View style={[styles.agendaEntry, { backgroundColor: `${habits}20` }]}><View style={[styles.entryMarker, { backgroundColor: habits }]} /><Text style={[styles.entryText, { color: textColor }]}>Leer 10 páginas</Text><Text style={[styles.entryTime, { color: habits }]}>🔥 4</Text></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', height: '88%', maxWidth: 520, maxHeight: '91%', borderWidth: 1, borderRadius: 26, overflow: 'hidden' },
  progressRow: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 }, backHidden: { opacity: 0 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6 }, progressDot: { width: 7, height: 7, borderRadius: 4 },
  content: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 20, gap: 14 },
  brandMark: { width: 54, height: 54, borderRadius: 20, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { fontFamily: 'Manrope-SemiBold', fontSize: 28, lineHeight: 36, fontWeight: 'normal', textAlign: 'center', letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Manrope-Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  previewCard: { width: '100%', maxWidth: 380, minHeight: 320, borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 6 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
  listPreview: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingBottom: 4 },
  listChip: { minHeight: 25, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 9, paddingHorizontal: 9 },
  listChipText: { fontFamily: 'Manrope-Medium', fontSize: 10 },
  addListChip: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 9 },
  previewTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 16 }, previewMeta: { fontFamily: 'Manrope-Medium', fontSize: 12 },
  taskLine: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 17, height: 17, borderRadius: 6, borderWidth: 1.5 }, taskText: { flex: 1, fontFamily: 'Manrope-Regular', fontSize: 13 },
  previewAdd: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  previewAddText: { fontFamily: 'Manrope-SemiBold', fontSize: 12 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 18, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 16 },
  buttonText: { fontFamily: 'Manrope-SemiBold', fontSize: 15, color: '#fff', fontWeight: 'normal' },
  guideWrap: { flex: 1, minHeight: 0, paddingBottom: 8 },
  agendaCard: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: 20, padding: 14, gap: 8, marginTop: 5 },
  agendaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, month: { fontFamily: 'Manrope-SemiBold', fontSize: 16 },
  viewPill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, viewPillText: { fontFamily: 'Manrope-Medium', fontSize: 11 },
  weekdayRow: { flexDirection: 'row' }, weekday: { width: '14.2857%', textAlign: 'center', fontFamily: 'Manrope-Medium', fontSize: 9 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.2857%', height: 31, borderRadius: 7, alignItems: 'center', justifyContent: 'center', gap: 2 },
  calendarDate: { fontFamily: 'Manrope-Medium', fontSize: 9, lineHeight: 12 }, eventDots: { height: 4, flexDirection: 'row', gap: 2 }, eventDot: { width: 4, height: 4, borderRadius: 2 },
  agendaEntries: { gap: 5, marginTop: 2 },
  agendaEntry: { minHeight: 30, borderRadius: 9, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryMarker: { width: 5, height: 18, borderRadius: 3 }, entryText: { flex: 1, fontFamily: 'Manrope-Medium', fontSize: 10 }, entryTime: { fontFamily: 'Manrope-Regular', fontSize: 9 },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 2 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  captionText: { fontFamily: 'Manrope-Medium', fontSize: 12 }, error: { marginHorizontal: 20, marginBottom: 8, textAlign: 'center', fontFamily: 'Manrope-Regular', fontSize: 12 },
});
