import {
  Body,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type OtpCodeProps = {
  code: string;
};

export const OtpCode = ({ code }: OtpCodeProps) => (
  <Html>
    <Head>
      <Font
        fontFamily="Lato"
        fallbackFontFamily="Helvetica"
        webFont={{
          url: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
          format: "woff2",
        }}
        fontWeight={400}
        fontStyle="normal"
      />
    </Head>
    <Preview>William Temple House login code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your Login Code</Heading>
        <Text style={text}>Use this code to sign in to William Temple House:</Text>
        <Section style={codeContainer}>
          <Text style={codeText}>{code}</Text>
        </Section>
        <Text style={footer}>
          This code expires in 10 minutes. If you did not request it, you can ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: "Lato, Helvetica, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "580px",
};

const h1 = {
  color: "#1d1c1d",
  fontSize: "28px",
  fontWeight: "700",
  margin: "24px 0",
  padding: "0",
  lineHeight: "36px",
};

const text = {
  color: "#484848",
  fontSize: "16px",
  lineHeight: "26px",
};

const codeContainer = {
  background: "#f4f4f4",
  borderRadius: "8px",
  margin: "24px 0",
  padding: "20px",
};

const codeText = {
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "8px",
  textAlign: "center" as const,
  color: "#1d1c1d",
  margin: 0,
};

const footer = {
  color: "#9ca299",
  fontSize: "14px",
  lineHeight: "24px",
  marginTop: "24px",
};

export default OtpCode;
