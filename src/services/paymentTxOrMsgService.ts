import { getPrismaClient } from '@helpers/database';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomString } from '@helpers/generate-random-string';
import {
  Payload,
  isEip681Payload,
  isContractCallPayload,
  isEip712Payload,
} from '@/types/paymentTx';
import { Prisma } from '@prisma/client';

/**
 * Helper for formatting the payload for storage in the database
 * @returns
 */
export const createPaymentTxOrMsg = async (payload: Payload) => {
  const prisma = getPrismaClient();

  const paymentUuid = payload.uuid || uuidv4();
  const verificationCode = generateRandomString();

  const baseData = {
    uuid: paymentUuid,
    verificationCode,
    chainId: payload.chainId,
    dappUrl: payload.dappUrl,
    dappName: payload.dappName,
    payloadType: payload.payloadType,
    additionalPayload: payload.additionalPayload,
    rpcProxySubmissionParams: JSON.stringify(payload.rpcProxySubmissionParams), // we stringify ths object to store it in the database to preserve field order
  };

  let txParams: Prisma.JsonValue;

  if (isEip681Payload(payload)) {
    txParams = {
      contractAddress: payload.contractAddress,
      toAddress: payload.toAddress,
      value: payload.value,
    };
  } else if (isContractCallPayload(payload)) {
    txParams = {
      requiresSenderAddress: payload.requiresSenderAddress,
      contractAbi: payload.contractAbi,
      placeholderSenderAddress: payload.placeholderSenderAddress,
      approveTxs: payload.approveTxs,
      paymentTx: payload.paymentTx,
    };
  } else if (isEip712Payload(payload)) {
    // noop, rpcProxySubmissionParams contains the message needed to be signed and submitted
    txParams = {};
  } else {
    throw new Error('Invalid payload type');
  }

  return prisma.contactlessPaymentTxOrMsg.create({
    data: {
      ...baseData,
      txParams,
    },
  });
};

/**
 * Get a payment transaction or message by uuid. Flattens the txParams object
 */
export const getPaymentTxOrMsg = async (uuid: string) => {
  const prisma = getPrismaClient();

  const paymentTxOrMsg = await prisma.contactlessPaymentTxOrMsg.findUnique({
    where: { uuid },
  });

  if (!paymentTxOrMsg) {
    throw new Error('Payment transaction or message not found');
  }

  // remove the txParams prop and flatten
  const { txParams, rpcProxySubmissionParams, ...rest } = paymentTxOrMsg;
  return {
    ...rest,
    rpcProxySubmissionParams: typeof rpcProxySubmissionParams === 'string' ? JSON.parse(rpcProxySubmissionParams) : undefined,
    ...(txParams as Record<string, unknown>),
  };
};

// adding a tx hash will let the client know that the transaction was sent
export const appendTxHashToPayment = async (uuid: string, txHash: string) => {
  const prisma = getPrismaClient();

  return prisma.contactlessPaymentTxOrMsg.update({
    where: { uuid },
    data: {
      txHash,
    },
  });
};