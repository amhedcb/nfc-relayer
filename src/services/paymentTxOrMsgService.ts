import { getPrismaClient } from '@helpers/database';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomString } from '@helpers/generate-random-string';
import {
  Payload,
  isEip681Payload,
  isContractCallPayload,
  isEip712Payload,
} from '@/types/paymentTx';

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
    rpcProxySubmissionParams: payload.rpcProxySubmissionParams,
  };

  // TODO: Amhed: Type better
  let txParams: any;

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
    txParams = { message: payload.message };
  } else {
    throw new Error('Invalid payload type');
  }

  return prisma.contactlessPaymentTxOrMsg.create({
    data: {
      ...baseData,
      txParams: txParams,
    },
  });
};

export const getPaymentTxOrMsg = async (uuid: string) => {
  const prisma = getPrismaClient();

  const paymentTxOrMsg = await prisma.contactlessPaymentTxOrMsg.findUnique({
    where: { uuid },
  });

  if (!paymentTxOrMsg) {
    throw new Error('Payment transaction or message not found');
  }

  // remove the txParams prop and flatten
  const { txParams, ...rest } = paymentTxOrMsg;
  return {
    ...rest,
    ...(txParams as Record<string, unknown>),
  };
};
