import type { Stage } from '../types'

export const stage4: Stage = {
  id: 'sw-4-minimize', order: 4, title: 'מינימיזציה',
  rooms: [{
    id: 'sw-4-r1', title: 'ארבע פינות',
    intro: 'מלאו את מפת קרנו של F(A,B,C,D) = Σ(0,2,8,10) וקבצו את הקבוצה האופטימלית.',
    puzzle: { type: 'kmap', nVars: 4, minterms: [0, 2, 8, 10], dontCares: [] },
    hints: [{ text: 'ארבע הפינות של המפה סמוכות זו לזו (המפה גלילית), ולכן יוצרות קבוצה אחת.' }],
  }],
  cards: [{
    id: 'sw-4-c1', kind: 'claim', stage: 'sw-4-minimize',
    text: 'במפת קרנו מותר לקבץ תאי don\'t care כדי לקבל קבוצה גדולה יותר.',
    isTrue: true,
    reasons: ['ערכם חופשי, ולכן אפשר להתייחס אליהם כ-1 כשזה מועיל', 'כי הם תמיד שווים ל-1'],
    correctReason: 0,
    examReason: 'תא X חופשי: מתייחסים אליו כ-1 רק כשהוא מגדיל קבוצה.',
    knowledge: 'תאי don\'t care אינם חובה לכסות, אך מותר לכלול אותם בקבוצות כדי לפשט את הביטוי.',
    source: 'סילבוס: שיטות מינימיזציה (מפות קרנו ושיטת הטבלה)',
  }],
}
