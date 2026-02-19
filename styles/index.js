import { StyleSheet, Platform } from 'react-native';

export const serifFont = Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' });

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9', // Clean light background
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  navGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  navPill: {
    backgroundColor: '#E5E5EA', // System light grey
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  navPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  headerTitle: {
    fontFamily: serifFont,
    fontSize: 42,
    fontWeight: '400',
    color: '#000000',
    paddingHorizontal: 24,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  editor: {
    flex: 1,
    paddingHorizontal: 24,
    fontSize: 18,
    fontFamily: serifFont,
    lineHeight: 28,
    color: '#333333',
  },
  editorWrapper: {
    flex: 1,
    position: 'relative',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000000',
    fontFamily: serifFont,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#F2F2F7',
    color: '#000000',
    fontFamily: serifFont,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000', // Will be overridden for save button
    fontFamily: serifFont,
  },
  debugPanel: {
    position: 'absolute',
    bottom: 60,
    left: 10,
    right: 10,
    maxHeight: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  debugActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  debugScroll: {
    flex: 1,
  },
  debugLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  debugText: {
    color: '#000000',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  // Image support styles
  imageBlock: {
    marginVertical: 12,
    marginHorizontal: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContent: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  imageCaption: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    fontStyle: 'italic',
    paddingHorizontal: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  imageLoadingContainer: {
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    marginHorizontal: 24,
  },
  imageLoadingText: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
});
