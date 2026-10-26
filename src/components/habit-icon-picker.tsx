import Pressable from '@/components/feedback-pressable';
import HabitSymbolView from '@/components/habit-symbol';
import { HABIT_ICON_CATEGORIES, searchHabitEmojis, searchHabitIcons, type HabitIconName } from '@/constants/habit-icons';
import type { HabitSymbol } from '@/models/habit';
import { useAppearance } from '@/theme/appearance';
import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  selected: HabitSymbol;
  accent: string;
  onSelect: (symbol: HabitSymbol) => void;
  onClose: () => void;
};

type Tab = 'icon' | 'emoji';

const GRID_GAP = 10;

export default function HabitIconPicker({ selected, accent, onSelect, onClose }: Props) {
  const { preferences } = useAppearance();
  const dark = preferences.dark;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>(selected.type === 'emoji' ? 'emoji' : 'icon');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const columns = width >= 720 ? 8 : 6;
  const pad = 20;
  const tile = Math.floor((Math.min(width, 660) - pad * 2 - GRID_GAP * (columns - 1)) / columns);
  const iconTint = dark ? '#E8EAED' : '#3c4043';

  const icons = useMemo(() => searchHabitIcons(query), [query]);
  const emojis = useMemo(() => searchHabitEmojis(query), [query]);
  const styles = useMemo(() => makeStyles(dark, accent), [dark, accent]);

  function chooseIcon(name: HabitIconName) {
    onSelect({ type: 'icon', name });
    onClose();
  }
  function chooseEmoji(value: string) {
    onSelect({ type: 'emoji', value });
    onClose();
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12), paddingBottom: insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onClose} style={styles.roundButton}>
            <MaterialIcons name="chevron-left" size={28} color={iconTint} />
          </Pressable>
          <View style={styles.tabs}>
            {(['icon', 'emoji'] as const).map((item) => (
              <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
                <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'icon' ? 'Icono' : 'Emoji'}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={searching ? 'Cerrar búsqueda' : 'Buscar icono'} onPress={() => { setSearching((open) => !open); if (searching) setQuery(''); }} style={styles.roundButton}>
            <MaterialIcons name={searching ? 'close' : 'search'} size={22} color={iconTint} />
          </Pressable>
        </View>
        {searching && (
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'icon' ? 'Buscar icono…' : 'Buscar emoji…'}
            placeholderTextColor={dark ? '#6b7280' : '#9aa0a6'}
            style={styles.search}
            accessibilityLabel="Buscar"
          />
        )}
        {tab === 'icon' ? (
          <FlatList
            data={icons}
            keyExtractor={(item) => item.name}
            numColumns={columns}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: GRID_GAP }}
            ListHeaderComponent={!query.trim() ? <Text style={styles.section}>{HABIT_ICON_CATEGORIES[0].label.toUpperCase()}</Text> : <Text style={styles.section}>{icons.length ? 'RESULTADOS' : 'SIN RESULTADOS'}</Text>}
            renderItem={({ item }) => {
              const active = selected.type === 'icon' && selected.name === item.name;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`Icono ${item.name}`} accessibilityState={{ selected: active }} onPress={() => chooseIcon(item.name)} style={[styles.tile, { width: tile, height: tile }, active && styles.tileActive]}>
                  <HabitSymbolView symbol={{ type: 'icon', name: item.name }} color={active ? accent : iconTint} size={Math.round(tile * 0.42)} />
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No encontramos ese icono. Probá con otra palabra.</Text>}
          />
        ) : (
          <FlatList
            data={emojis}
            keyExtractor={(item) => item}
            numColumns={columns}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: GRID_GAP }}
            ListHeaderComponent={<Text style={styles.section}>{query.trim() ? (emojis.length ? 'RESULTADOS' : 'SIN RESULTADOS') : 'EMOJIS'}</Text>}
            renderItem={({ item }) => {
              const active = selected.type === 'emoji' && selected.value === item;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`Emoji ${item}`} accessibilityState={{ selected: active }} onPress={() => chooseEmoji(item)} style={[styles.tile, { width: tile, height: tile }, active && styles.tileActive]}>
                  <Text style={{ fontSize: Math.round(tile * 0.42) }}>{item}</Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No encontramos ese emoji.</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

function makeStyles(dark: boolean, accent: string) {
  const bg = dark ? '#121212' : '#f4f5f7';
  const tile = dark ? '#1E1E1E' : '#ffffff';
  const text = dark ? '#E8EAED' : '#202124';
  const muted = dark ? '#9aa0a6' : '#5f6368';
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: bg, maxWidth: 660, width: '100%', alignSelf: 'center' },
    handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: dark ? '#3a3a3a' : '#dadce0', marginBottom: 10 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8, gap: 10 },
    roundButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' },
    tabs: { flexDirection: 'row', backgroundColor: tile, borderRadius: 22, padding: 4, gap: 2 },
    tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18 },
    tabActive: { backgroundColor: dark ? '#3D3D5C' : accent },
    tabText: { fontFamily: 'Manrope-Medium', fontSize: 14, color: muted },
    tabTextActive: { color: '#fff' },
    search: { marginHorizontal: 20, marginBottom: 10, borderRadius: 14, backgroundColor: tile, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Manrope-Regular', fontSize: 16, color: text },
    section: { fontFamily: 'Manrope-Medium', fontSize: 12, letterSpacing: 1.2, color: muted, marginBottom: 12, marginTop: 4 },
    grid: { paddingHorizontal: 20, paddingBottom: 40, rowGap: GRID_GAP },
    tile: { borderRadius: 14, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' },
    tileActive: { borderWidth: 2, borderColor: accent },
    empty: { textAlign: 'center', fontFamily: 'Manrope-Regular', fontSize: 14, color: muted, padding: 24 },
  });
}
