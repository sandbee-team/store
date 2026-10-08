"use strict";
const nodemailer = require("nodemailer");
const { renderEmail, renderInvitation } = require("./templates");
const { AppError } = require("../../shared/errors");
function createMailer(config) {
  const mail = config.mail;
  const transport = mail?.host
    ? nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.port === 465,
        ...(mail.user
          ? { auth: { user: mail.user, pass: mail.password } }
          : {}),
        requireTLS: mail.host === "smtp.gmail.com",
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        logger: false,
        debug: false,
      })
    : null;
  return {
    async invite({ to, ...input }) {
      if (!transport)
        throw new AppError(
          503,
          "MAIL_UNAVAILABLE",
          "Email delivery is temporarily unavailable.",
        );
      try {
        await transport.sendMail({
          from: { name: "Sandbee Store", address: mail.from },
          to,
          ...renderInvitation(input),
        });
      } catch {
        throw new AppError(
          503,
          "MAIL_UNAVAILABLE",
          "Invitation email could not be delivered.",
        );
      }
    },
    async passwordChanged(to) {
      if (!transport) return;
      await transport.sendMail({
        from: { name: "Sandbee Store", address: mail.from },
        to,
        ...renderEmail({ purpose: "changed", appUrl: config.appUrl }),
      });
    },
    async send({ to, code, purpose }) {
      if (!transport)
        throw new AppError(
          503,
          "MAIL_UNAVAILABLE",
          "Email delivery is temporarily unavailable. Please try again shortly.",
        );
      try {
        await transport.sendMail({
          from: { name: "Sandbee Store", address: mail.from },
          to,
          ...renderEmail({ purpose, code, appUrl: config.appUrl }),
        });
      } catch {
        throw new AppError(
          503,
          "MAIL_UNAVAILABLE",
          "Email delivery is temporarily unavailable. Please try again shortly.",
        );
      }
    },
  };
}
module.exports = { createMailer };
