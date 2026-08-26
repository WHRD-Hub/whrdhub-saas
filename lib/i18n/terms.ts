import type { Language } from "./translations";

export interface TermsContent {
  heading: string;
  intro: string;
  sections: { title: string; body: string }[];
  acceptLabel: string;
  storedNote: string;
  continue: string;
  settingUp: string;
  stepLabel: string;
}

// English (source) + Swahili (primary Kenya locale) are fully translated.
// Other languages fall back to English via getTerms().
const en: TermsContent = {
  heading: "Terms & Conditions",
  intro: "Please read and accept our terms before accessing your reports and dashboard.",
  sections: [
    {
      title: "Data Privacy & Confidentiality",
      body: `All reports submitted through WHRD Hub are treated as strictly confidential. We collect only the minimum data required to process each report. Personal information is encrypted at rest and in transit using industry-standard protocols.

Reporter identities are protected at all times. Anonymous accounts cannot be traced back to individuals without user-disclosed information. Platform staff have a duty to maintain confidentiality of all reporter information and case details — disclosure to unauthorised parties is grounds for immediate account suspension.`,
    },
    {
      title: "Acceptable Use Policy",
      body: `WHRD Hub is intended exclusively for reporting and responding to technology-facilitated gender-based violence (TFGBV) and related human rights violations. You may not use this platform to submit false reports, harass individuals, or engage in any activity that violates applicable laws.

All users must use their access only for legitimate platform purposes. Misuse of reporter data, unauthorised disclosure of case information, or abuse of platform features may result in immediate account suspension and referral to relevant authorities.`,
    },
    {
      title: "Your Rights as a User",
      body: `You have the right to access your own account data and request corrections at any time. You have the right to withdraw your consent and delete your account upon request.

You are responsible for maintaining the security of your login credentials and must report any suspected unauthorised access immediately. All use of this platform must comply with applicable data protection laws including Kenya's Data Protection Act 2019.`,
    },
    {
      title: "Platform Safety & Escalation",
      body: `If you submit a report indicating an immediate risk to life or safety, it will be treated as a priority and escalated as quickly as possible. For any emergency, please also contact Kenya Police (999) or the GBV Helpline (1195) directly.

WHRD Hub operates under a duty of care to all users. We follow trauma-informed practices and will not request more information than necessary to help you.`,
    },
  ],
  acceptLabel:
    "I have read and I accept the WHRD Hub Terms & Conditions. I understand my reports are handled confidentially and I may request data deletion at any time.",
  storedNote: "Your acceptance is recorded with a timestamp and stored securely on your account.",
  continue: "Continue to Dashboard",
  settingUp: "Setting up your account…",
  stepLabel: "Terms & Conditions",
};

const sw: TermsContent = {
  heading: "Sheria na Masharti",
  intro: "Tafadhali soma na ukubali masharti yetu kabla ya kufikia ripoti zako na dashibodi.",
  sections: [
    {
      title: "Faragha ya Data na Usiri",
      body: `Ripoti zote zinazowasilishwa kupitia WHRD Hub zinashughulikiwa kwa usiri mkubwa. Tunakusanya data ndogo tu inayohitajika kushughulikia kila ripoti. Taarifa binafsi zinasimbwa (encrypted) zikiwa zimehifadhiwa na zinaposafirishwa, kwa kutumia itifaki za kiwango cha juu.

Utambulisho wa wanaoripoti unalindwa wakati wote. Akaunti zisizojulikana haziwezi kufuatiliwa hadi kwa mtu binafsi bila taarifa alizozitoa mtumiaji mwenyewe. Wafanyakazi wa jukwaa wana wajibu wa kudumisha usiri wa taarifa zote za wanaoripoti na maelezo ya kesi — kufichua kwa watu wasioidhinishwa ni sababu ya kusimamishwa kwa akaunti mara moja.`,
    },
    {
      title: "Sera ya Matumizi Yanayokubalika",
      body: `WHRD Hub imekusudiwa kwa ajili ya kuripoti na kukabiliana na ukatili wa kijinsia unaowezeshwa na teknolojia (TFGBV) na ukiukwaji wa haki za binadamu unaohusiana. Huruhusiwi kutumia jukwaa hili kuwasilisha ripoti za uongo, kunyanyasa watu, au kushiriki katika shughuli yoyote inayokiuka sheria zinazotumika.

Watumiaji wote lazima watumie ufikiaji wao kwa madhumuni halali ya jukwaa pekee. Matumizi mabaya ya data ya wanaoripoti, kufichua taarifa za kesi bila idhini, au kutumia vibaya vipengele vya jukwaa kunaweza kusababisha kusimamishwa kwa akaunti mara moja na kupelekwa kwa mamlaka husika.`,
    },
    {
      title: "Haki Zako kama Mtumiaji",
      body: `Una haki ya kufikia data ya akaunti yako mwenyewe na kuomba marekebisho wakati wowote. Una haki ya kuondoa idhini yako na kufuta akaunti yako unapoomba.

Wewe una wajibu wa kudumisha usalama wa maelezo yako ya kuingia na lazima uripoti mara moja ufikiaji wowote unaoshukiwa kuwa haukuidhinishwa. Matumizi yote ya jukwaa hili lazima yazingatie sheria za ulinzi wa data zinazotumika, ikijumuisha Sheria ya Ulinzi wa Data ya Kenya ya 2019.`,
    },
    {
      title: "Usalama wa Jukwaa na Kupandisha Kesi",
      body: `Ukiwasilisha ripoti inayoonyesha hatari ya papo hapo kwa maisha au usalama, itashughulikiwa kama kipaumbele na kupandishwa haraka iwezekanavyo. Kwa dharura yoyote, tafadhali pia wasiliana moja kwa moja na Polisi wa Kenya (999) au Simu ya Msaada ya GBV (1195).

WHRD Hub inafanya kazi kwa wajibu wa kutunza watumiaji wote. Tunafuata mbinu zinazozingatia athari za kiwewe na hatutaomba taarifa zaidi ya zinazohitajika kukusaidia.`,
    },
  ],
  acceptLabel:
    "Nimesoma na ninakubali Sheria na Masharti ya WHRD Hub. Ninaelewa kuwa ripoti zangu zinashughulikiwa kwa usiri na ninaweza kuomba kufutwa kwa data wakati wowote.",
  storedNote: "Kukubali kwako kunarekodiwa na muhuri wa muda na kuhifadhiwa kwa usalama kwenye akaunti yako.",
  continue: "Endelea kwenye Dashibodi",
  settingUp: "Inaandaa akaunti yako…",
  stepLabel: "Sheria na Masharti",
};

const TERMS_CONTENT: Partial<Record<Language, TermsContent>> = { en, sw };

export function getTerms(lang: Language): TermsContent {
  return TERMS_CONTENT[lang] ?? en;
}
